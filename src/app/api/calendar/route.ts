import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const eventId = searchParams.get('id')

  try {
    if (eventId) {
      const event = await db.prepare(
        `SELECT e.*, u.full_name as agent_name FROM calendar_events e LEFT JOIN users u ON e.agent_id = u.id WHERE e.id = ?`
      ).bind(eventId).first()
      if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(event)
    }

    let query = isAdmin
      ? `SELECT e.*, u.full_name as agent_name FROM calendar_events e LEFT JOIN users u ON e.agent_id = u.id WHERE e.org_id = ?`
      : `SELECT e.*, u.full_name as agent_name FROM calendar_events e LEFT JOIN users u ON e.agent_id = u.id WHERE e.agent_id = ?`

    const binds: any[] = [isAdmin ? (user.org_id || 'org_mg') : user.id]

    if (start) {
      query += ' AND e.end_time >= ?'
      binds.push(start)
    }
    if (end) {
      query += ' AND e.start_time <= ?'
      binds.push(end)
    }

    query += ' ORDER BY e.start_time ASC'

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
      INSERT INTO calendar_events (id, org_id, agent_id, title, event_type, start_time, end_time, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId,
      data.agent_id || user.id,
      data.title || '',
      data.event_type || 'otro',
      data.start_time || null,
      data.end_time || null,
      data.description || null
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
      UPDATE calendar_events SET
        title=?, event_type=?, start_time=?, end_time=?,
        description=?, agent_id=?, updated_at=datetime('now')
      WHERE id=?
    `).bind(
      data.title || '',
      data.event_type || 'otro',
      data.start_time || null,
      data.end_time || null,
      data.description || null,
      data.agent_id || null,
      data.id
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
    await db.prepare('DELETE FROM calendar_events WHERE id = ?').bind(id).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
