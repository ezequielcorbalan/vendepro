import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// Default checklist items for a property
const DEFAULT_ITEMS = [
  'Autorización de venta firmada',
  'Título de propiedad',
  'Escritura',
  'Plano de mensura',
  'Reglamento de copropiedad',
  'Libre deuda de expensas',
  'Libre deuda municipal (ABL)',
  'Libre deuda de AYSA',
  'Libre deuda de impuesto inmobiliario',
  'Informe de dominio (30 días)',
  'Informe de inhibición',
  'DNI del propietario',
  'Constancia CUIT/CUIL',
  'Certificado de matrimonio (si aplica)',
  'Fotos profesionales',
  'Plano actualizado',
]

// GET — get checklist for a property
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('property_id')
  if (!propertyId) return NextResponse.json({ error: 'Missing property_id' }, { status: 400 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    const items = (await db.prepare(
      'SELECT * FROM property_checklist WHERE property_id = ? AND org_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).bind(propertyId, orgId).all()).results

    return NextResponse.json({ items, total: items.length, checked: items.filter((i: any) => i.checked).length })
  } catch (err: any) {
    return NextResponse.json({ items: [], total: 0, checked: 0 })
  }
}

// POST — create default checklist or add custom item
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  const propertyId = data.property_id
  if (!propertyId) return NextResponse.json({ error: 'Missing property_id' }, { status: 400 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    if (data.action === 'create_defaults') {
      // Check if already has items
      const existing = (await db.prepare(
        'SELECT COUNT(*) as c FROM property_checklist WHERE property_id = ? AND org_id = ?'
      ).bind(propertyId, orgId).first()) as any

      if (existing?.c > 0) return NextResponse.json({ error: 'Checklist already exists' }, { status: 400 })

      // Insert all defaults
      for (let i = 0; i < DEFAULT_ITEMS.length; i++) {
        await db.prepare(
          "INSERT INTO property_checklist (id, org_id, property_id, item_name, sort_order) VALUES (?, ?, ?, ?, ?)"
        ).bind(generateId(), orgId, propertyId, DEFAULT_ITEMS[i], i).run()
      }

      return NextResponse.json({ created: DEFAULT_ITEMS.length })
    }

    // Add custom item
    if (data.item_name) {
      const id = generateId()
      await db.prepare(
        "INSERT INTO property_checklist (id, org_id, property_id, item_name, sort_order) VALUES (?, ?, ?, ?, 999)"
      ).bind(id, orgId, propertyId, data.item_name).run()
      return NextResponse.json({ id })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT — toggle checked or update item
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  if (!data.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    if (data.action === 'toggle') {
      const item = (await db.prepare(
        'SELECT * FROM property_checklist WHERE id = ? AND org_id = ?'
      ).bind(data.id, orgId).first()) as any
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const newChecked = item.checked ? 0 : 1
      await db.prepare(
        'UPDATE property_checklist SET checked = ?, checked_at = datetime(\'now\'), checked_by = ? WHERE id = ?'
      ).bind(newChecked, user.id, data.id).run()

      // Update property doc_completion_pct
      const stats = (await db.prepare(
        'SELECT COUNT(*) as total, SUM(CASE WHEN checked=1 THEN 1 ELSE 0 END) as done FROM property_checklist WHERE property_id = ? AND org_id = ?'
      ).bind(item.property_id, orgId).first()) as any
      const pct = stats?.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
      try {
        await db.prepare('UPDATE properties SET doc_completion_pct = ? WHERE id = ?').bind(pct, item.property_id).run()
      } catch {}

      return NextResponse.json({ checked: newChecked, pct })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — remove checklist item
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    await db.prepare('DELETE FROM property_checklist WHERE id = ? AND org_id = ?').bind(id, orgId).run()
    return NextResponse.json({ deleted: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
