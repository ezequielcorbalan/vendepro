import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/export?type=leads|activities|properties
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const type = new URL(request.url).searchParams.get('type') || 'leads'

  try {
    let rows: any[] = []
    let headers: string[] = []

    if (type === 'leads') {
      headers = ['Nombre', 'Teléfono', 'Email', 'Operación', 'Barrio', 'Etapa', 'Origen', 'Agente', 'Presupuesto', 'Próxima acción', 'Creado', 'Actualizado']
      const results = (await db.prepare(`
        SELECT l.*, u.full_name as agent_name FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.id
        WHERE l.org_id = ?${isAdmin ? '' : ' AND l.assigned_to = ?'}
        ORDER BY l.created_at DESC
      `).bind(...(isAdmin ? [orgId] : [orgId, user.id])).all()).results as any[]
      rows = results.map(r => [
        r.full_name, r.phone, r.email, r.operation, r.neighborhood,
        r.stage, r.source, r.agent_name, r.estimated_value,
        r.next_step, r.created_at?.split('T')[0], r.updated_at?.split('T')[0]
      ])
    } else if (type === 'activities') {
      headers = ['Tipo', 'Descripción', 'Agente', 'Lead', 'Contacto', 'Resultado', 'Fecha']
      const results = (await db.prepare(`
        SELECT a.*, u.full_name as agent_name, l.full_name as lead_name, c.full_name as contact_name
        FROM activities a
        LEFT JOIN users u ON a.agent_id = u.id
        LEFT JOIN leads l ON a.lead_id = l.id
        LEFT JOIN contacts c ON a.contact_id = c.id
        WHERE a.org_id = ?${isAdmin ? '' : ' AND a.agent_id = ?'}
        ORDER BY a.created_at DESC LIMIT 1000
      `).bind(...(isAdmin ? [orgId] : [orgId, user.id])).all()).results as any[]
      rows = results.map(r => [
        r.activity_type, r.description, r.agent_name, r.lead_name, r.contact_name,
        r.outcome, r.created_at?.split('T')[0]
      ])
    } else if (type === 'properties') {
      headers = ['Dirección', 'Barrio', 'Tipo', 'Propietario', 'Teléfono', 'Precio', 'Etapa', 'Agente', 'Creado']
      const results = (await db.prepare(`
        SELECT p.*, u.full_name as agent_name FROM properties p
        LEFT JOIN users u ON p.agent_id = u.id
        WHERE p.org_id = ?${isAdmin ? '' : ' AND p.agent_id = ?'}
        ORDER BY p.created_at DESC
      `).bind(...(isAdmin ? [orgId] : [orgId, user.id])).all()).results as any[]
      rows = results.map(r => [
        r.address, r.neighborhood, r.property_type, r.owner_name, r.owner_phone,
        r.asking_price, r.commercial_stage || r.status, r.agent_name, r.created_at?.split('T')[0]
      ])
    }

    // Build CSV
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`
      return str
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n')

    // BOM for Excel UTF-8
    const bom = '\uFEFF'
    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${type}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
