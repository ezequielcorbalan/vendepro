import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  const agentId = searchParams.get('agent_id')
  const isAdmin = user.role === 'admin' || user.role === 'owner'

  try {
    let query = `SELECT a.*, u.full_name as agent_name, l.full_name as lead_name
      FROM activities a
      LEFT JOIN users u ON a.agent_id = u.id
      LEFT JOIN leads l ON a.lead_id = l.id
      WHERE a.org_id = ?`
    const binds: any[] = [user.org_id || 'org_mg']

    if (leadId) {
      query += ' AND a.lead_id = ?'
      binds.push(leadId)
    }

    if (agentId) {
      query += ' AND a.agent_id = ?'
      binds.push(agentId)
    } else if (!isAdmin) {
      query += ' AND a.agent_id = ?'
      binds.push(user.id)
    }

    // Date range filter
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    if (startDate) { query += ' AND a.created_at >= ?'; binds.push(startDate) }
    if (endDate) { query += ' AND a.created_at <= ?'; binds.push(endDate) }

    // Activity type filter
    const actType = searchParams.get('type')
    if (actType) { query += ' AND a.activity_type = ?'; binds.push(actType) }

    query += ' ORDER BY a.created_at DESC LIMIT 200'

    const results = (await db.prepare(query).bind(...binds).all()).results
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
      INSERT INTO activities (id, org_id, lead_id, contact_id, agent_id, activity_type, description, scheduled_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, user.org_id || 'org_mg',
      data.lead_id || null, data.contact_id || null,
      data.agent_id || user.id,
      data.activity_type,
      data.description || null,
      data.scheduled_at || null,
      data.completed_at || null
    ).run()

    return NextResponse.json({ id })
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
    await db.prepare('DELETE FROM activities WHERE id = ? AND org_id = ?').bind(id, user.org_id || 'org_mg').run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
