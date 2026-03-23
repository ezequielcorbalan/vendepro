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
  const filterType = searchParams.get('type')
  const filterAgent = searchParams.get('agent_id')
  const filterStatus = searchParams.get('status')
  const onlyMine = searchParams.get('mine') === '1'
  const overdue = searchParams.get('overdue') === '1'

  try {
    if (eventId) {
      const event = await db.prepare(`
        SELECT e.*,
          u.full_name as agent_name, u.phone as agent_phone,
          l.full_name as lead_name, l.phone as lead_phone,
          c.full_name as contact_name, c.phone as contact_phone,
          p.address as property_address
        FROM calendar_events e
        LEFT JOIN users u ON e.agent_id = u.id
        LEFT JOIN leads l ON e.lead_id = l.id
        LEFT JOIN contacts c ON e.contact_id = c.id
        LEFT JOIN properties p ON e.property_id = p.id
        WHERE e.id = ?
      `).bind(eventId).first()
      if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(event)
    }

    let query = `
      SELECT e.*,
        u.full_name as agent_name, u.phone as agent_phone,
        l.full_name as lead_name, l.phone as lead_phone,
        c.full_name as contact_name, c.phone as contact_phone,
        p.address as property_address
      FROM calendar_events e
      LEFT JOIN users u ON e.agent_id = u.id
      LEFT JOIN leads l ON e.lead_id = l.id
      LEFT JOIN contacts c ON e.contact_id = c.id
      LEFT JOIN properties p ON e.property_id = p.id
      WHERE e.org_id = ?
    `
    const binds: any[] = [user.org_id || 'org_mg']

    // Agent filter
    if (onlyMine || (!isAdmin && !filterAgent)) {
      query += ' AND e.agent_id = ?'
      binds.push(user.id)
    } else if (filterAgent) {
      query += ' AND e.agent_id = ?'
      binds.push(filterAgent)
    }

    // Date range
    if (start) {
      query += ' AND e.end_at >= ?'
      binds.push(start)
    }
    if (end) {
      query += ' AND e.start_at <= ?'
      binds.push(end)
    }

    // Type filter
    if (filterType) {
      query += ' AND e.event_type = ?'
      binds.push(filterType)
    }

    // Status filter
    if (filterStatus === 'completed') {
      query += ' AND e.completed = 1'
    } else if (filterStatus === 'pending') {
      query += ' AND e.completed = 0'
    }

    // Overdue: past events not completed
    if (overdue) {
      query += " AND e.completed = 0 AND e.end_at < datetime('now')"
    }

    query += ' ORDER BY e.start_at ASC LIMIT 500'

    const results = (await db.prepare(query).bind(...binds).all()).results as any[]

    // Add overdue flag to each event
    const now = new Date().toISOString()
    const enriched = results.map((e: any) => ({
      ...e,
      overdue: e.completed === 0 && e.end_at && e.end_at < now,
      // Resolve phone for quick actions
      phone: e.lead_phone || e.contact_phone || null,
    }))

    return NextResponse.json(enriched)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  if (!data.title) return NextResponse.json({ error: 'Missing title' }, { status: 400 })

  const validEventTypes = ['llamada', 'reunion', 'visita_captacion', 'visita_comprador', 'tasacion', 'seguimiento', 'admin', 'firma', 'otro']
  if (data.event_type && !validEventTypes.includes(data.event_type)) {
    return NextResponse.json({ error: `Invalid event_type: ${data.event_type}` }, { status: 400 })
  }

  const db = await getDB()
  const id = generateId()
  const orgId = user.org_id || 'org_mg'

  try {
    await db.prepare(`
      INSERT INTO calendar_events (id, org_id, agent_id, title, event_type,
        start_at, end_at, all_day, description,
        lead_id, contact_id, property_id, appraisal_id, reservation_id, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId,
      data.agent_id || user.id,
      data.title || '',
      data.event_type || 'otro',
      data.start_at || null,
      data.end_at || null,
      data.all_day ? 1 : 0,
      data.description || null,
      data.lead_id || null,
      data.contact_id || null,
      data.property_id || null,
      data.appraisal_id || null,
      data.reservation_id || null,
      data.color || null
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
    // If only toggling completed
    if (data._action === 'toggle_complete') {
      await db.prepare(
        "UPDATE calendar_events SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?"
      ).bind(data.id).run()
      return NextResponse.json({ success: true })
    }

    // If rescheduling
    if (data._action === 'reschedule') {
      await db.prepare(
        "UPDATE calendar_events SET start_at = ?, end_at = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(data.start_at, data.end_at, data.id).run()
      return NextResponse.json({ success: true })
    }

    // Full update
    await db.prepare(`
      UPDATE calendar_events SET
        title=?, event_type=?, start_at=?, end_at=?, all_day=?,
        description=?, agent_id=?,
        lead_id=?, contact_id=?, property_id=?, appraisal_id=?, reservation_id=?,
        color=?, completed=?, updated_at=datetime('now')
      WHERE id=?
    `).bind(
      data.title || '',
      data.event_type || 'otro',
      data.start_at || null,
      data.end_at || null,
      data.all_day ? 1 : 0,
      data.description || null,
      data.agent_id || null,
      data.lead_id || null,
      data.contact_id || null,
      data.property_id || null,
      data.appraisal_id || null,
      data.reservation_id || null,
      data.color || null,
      data.completed ? 1 : 0,
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
