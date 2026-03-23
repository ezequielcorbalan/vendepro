import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

async function logStageChange(db: any, orgId: string, entityId: string, fromStage: string | null, toStage: string, changedBy: string, notes?: string) {
  const id = generateId()
  await db.prepare(
    `INSERT INTO stage_history (id, org_id, entity_type, entity_id, from_stage, to_stage, changed_by, notes)
     VALUES (?, ?, 'reservation', ?, ?, ?, ?, ?)`
  ).bind(id, orgId, entityId, fromStage, toStage, changedBy, notes || null).run()
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')
  const reservationId = searchParams.get('id')

  try {
    if (reservationId) {
      const reservation = await db.prepare(
        `SELECT r.*, u.full_name as agent_name
         FROM reservations r
         LEFT JOIN users u ON r.agent_id = u.id
         WHERE r.id = ?`
      ).bind(reservationId).first()
      if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const history = (await db.prepare(
        `SELECT sh.*, u.full_name as changed_by_name FROM stage_history sh LEFT JOIN users u ON sh.changed_by = u.id WHERE sh.entity_type = 'reservation' AND sh.entity_id = ? ORDER BY sh.created_at DESC`
      ).bind(reservationId).all()).results as any[]

      return NextResponse.json({ reservation, history })
    }

    let query = isAdmin
      ? `SELECT r.*, u.full_name as agent_name
         FROM reservations r
         LEFT JOIN users u ON r.agent_id = u.id
         WHERE r.org_id = ?`
      : `SELECT r.*, u.full_name as agent_name
         FROM reservations r
         LEFT JOIN users u ON r.agent_id = u.id
         WHERE r.agent_id = ?`

    const binds: any[] = [isAdmin ? (user.org_id || 'org_mg') : user.id]

    if (stage) {
      query += ' AND r.stage = ?'
      binds.push(stage)
    }

    query += ' ORDER BY r.created_at DESC'

    const results = (await db.prepare(query).bind(...binds).all()).results as any[]
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
  const orgId = user.org_id || 'org_mg'

  try {
    await db.prepare(`
      INSERT INTO reservations (id, org_id, property_address, buyer_name, seller_name,
        agent_id, offer_amount, offer_currency, reservation_date, stage, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId,
      data.property_address || null,
      data.buyer_name || null,
      data.seller_name || null,
      data.agent_id || user.id,
      data.offer_amount || null,
      data.offer_currency || 'USD',
      data.reservation_date || new Date().toISOString().split('T')[0],
      data.stage || 'reservada',
      data.notes || null
    ).run()

    try {
      await logStageChange(db, orgId, id, null, data.stage || 'reservada', user.id)
    } catch { /* stage_history table may not exist */ }

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
  const orgId = user.org_id || 'org_mg'

  try {
    const current = await db.prepare('SELECT stage FROM reservations WHERE id = ?').bind(data.id).first() as any
    const oldStage = current?.stage

    await db.prepare(`
      UPDATE reservations SET
        property_address=?, buyer_name=?, seller_name=?,
        agent_id=?, offer_amount=?, offer_currency=?,
        reservation_date=?, stage=?, notes=?,
        updated_at=datetime('now')
      WHERE id=?
    `).bind(
      data.property_address || null,
      data.buyer_name || null,
      data.seller_name || null,
      data.agent_id || null,
      data.offer_amount || null,
      data.offer_currency || 'USD',
      data.reservation_date || null,
      data.stage || 'reservada',
      data.notes || null,
      data.id
    ).run()

    if (oldStage && data.stage && oldStage !== data.stage) {
      await logStageChange(db, orgId, data.id, oldStage, data.stage, user.id, data.stage_notes)
    }

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
    await db.prepare('DELETE FROM stage_history WHERE entity_type = ? AND entity_id = ?').bind('reservation', id).run()
    await db.prepare('DELETE FROM reservations WHERE id = ?').bind(id).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
