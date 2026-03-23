import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = await getDB()
  const results = (await db.prepare(
    'SELECT sp.*, u.full_name as agent_name FROM sold_properties sp LEFT JOIN users u ON sp.agent_id = u.id ORDER BY sp.sold_date DESC'
  ).all()).results

  return NextResponse.json(results)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json() as any
  const db = await getDB()
  const id = generateId()

  await db.prepare(`
    INSERT INTO sold_properties (id, org_id, address, neighborhood, property_type, rooms, total_area,
      sold_price, original_price, currency, sold_date, days_on_market, agent_id, listing_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, user.org_id || 'org_mg',
    body.address, body.neighborhood, body.property_type || null,
    body.rooms ? parseInt(body.rooms) : null,
    body.total_area ? parseFloat(body.total_area) : null,
    body.sold_price ? parseFloat(body.sold_price) : null,
    body.original_price ? parseFloat(body.original_price) : null,
    body.currency || 'USD', body.sold_date || null,
    body.days_on_market ? parseInt(body.days_on_market) : null,
    body.agent_id || user.id,
    body.listing_url || null
  ).run()

  return NextResponse.json({ id })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const db = await getDB()
  await db.prepare('DELETE FROM sold_properties WHERE id = ?').bind(id).run()

  return NextResponse.json({ success: true })
}
