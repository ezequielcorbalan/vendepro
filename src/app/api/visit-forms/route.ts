import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/visit-forms?property_id=xxx — list visit forms for a property
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('property_id')
  const reportId = searchParams.get('report_id')
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    let sql = 'SELECT * FROM visit_forms WHERE org_id = ?'
    const binds: any[] = [orgId]

    if (propertyId) { sql += ' AND property_id = ?'; binds.push(propertyId) }
    if (reportId) { sql += ' AND report_id = ?'; binds.push(reportId) }

    sql += ' ORDER BY created_at DESC'
    const results = (await db.prepare(sql).bind(...binds).all()).results
    return NextResponse.json(results)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/visit-forms — create a visit form (PUBLIC - no auth required for visitors)
export async function POST(request: NextRequest) {
  const data = (await request.json()) as any
  const db = await getDB()
  const id = generateId()

  if (!data.property_id || !data.visitor_name) {
    return NextResponse.json({ error: 'Nombre y propiedad son requeridos' }, { status: 400 })
  }

  try {
    await db.prepare(`
      INSERT INTO visit_forms (id, org_id, property_id, report_id, visitor_name, visitor_phone, visitor_email,
        visit_date, rating, likes, dislikes, would_buy, price_opinion, comments, how_found,
        current_situation, financing, agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, data.org_id || 'org_mg', data.property_id, data.report_id || null,
      data.visitor_name, data.visitor_phone || null, data.visitor_email || null,
      data.visit_date || new Date().toISOString().split('T')[0],
      data.rating || null, data.likes || null, data.dislikes || null,
      data.would_buy !== undefined ? (data.would_buy ? 1 : 0) : null,
      data.price_opinion || null, data.comments || null, data.how_found || null,
      data.current_situation || null, data.financing || null, data.agent_id || null
    ).run()

    return NextResponse.json({ id, success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/visit-forms?id=xxx
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  await db.prepare('DELETE FROM visit_forms WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  return NextResponse.json({ deleted: true })
}
