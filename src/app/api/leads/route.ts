import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const isAdmin = user.role === 'admin' || user.role === 'owner'

  try {
    const query = isAdmin
      ? `SELECT l.*, u.full_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.org_id = ? ORDER BY l.created_at DESC`
      : `SELECT l.* FROM leads l WHERE l.assigned_to = ? ORDER BY l.created_at DESC`

    const results = isAdmin
      ? (await db.prepare(query).bind(user.org_id || 'org_mg').all()).results
      : (await db.prepare(query).bind(user.id).all()).results

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  const db = await getDB()
  const id = generateId()

  try {
    await db.prepare(`
      INSERT INTO leads (id, org_id, full_name, phone, email, source, source_detail,
        property_address, neighborhood, property_type, operation, stage, assigned_to, notes, estimated_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, user.org_id || 'org_mg',
      data.full_name, data.phone || null, data.email || null,
      data.source || 'manual', data.source_detail || null,
      data.property_address || null, data.neighborhood || null,
      data.property_type || null, data.operation || 'venta',
      data.stage || 'nuevo', data.assigned_to || user.id,
      data.notes || null, data.estimated_value || null
    ).run()

    return NextResponse.json({ id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  if (!data.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDB()

  try {
    await db.prepare(`
      UPDATE leads SET full_name=?, phone=?, email=?, source=?, source_detail=?,
        property_address=?, neighborhood=?, property_type=?, operation=?, stage=?,
        assigned_to=?, notes=?, estimated_value=?, updated_at=datetime('now')
      WHERE id=?
    `).bind(
      data.full_name, data.phone || null, data.email || null,
      data.source || 'manual', data.source_detail || null,
      data.property_address || null, data.neighborhood || null,
      data.property_type || null, data.operation || 'venta',
      data.stage || 'nuevo', data.assigned_to || null,
      data.notes || null, data.estimated_value || null, data.id
    ).run()

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDB()

  try {
    await db.prepare('DELETE FROM activities WHERE lead_id = ?').bind(id).run()
    await db.prepare('DELETE FROM leads WHERE id = ?').bind(id).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
