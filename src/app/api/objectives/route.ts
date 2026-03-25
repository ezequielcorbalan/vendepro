import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id')
  const periodType = searchParams.get('period_type')

  try {
    let query = `SELECT o.*, u.full_name as agent_name FROM agent_objectives o LEFT JOIN users u ON o.agent_id = u.id WHERE o.org_id = ?`
    const binds: any[] = [orgId]

    if (agentId) {
      query += ' AND o.agent_id = ?'
      binds.push(agentId)
    } else if (!isAdmin) {
      query += ' AND o.agent_id = ?'
      binds.push(user.id)
    }

    if (periodType) {
      query += ' AND o.period_type = ?'
      binds.push(periodType)
    }

    // Only current/future periods
    query += ` AND o.period_end >= date('now') ORDER BY o.period_start DESC LIMIT 50`

    const results = (await db.prepare(query).bind(...binds).all()).results as any[]
    return NextResponse.json(results)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const isAdmin = user.role === 'admin' || user.role === 'owner'
  if (!isAdmin) return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

  const data = (await request.json()) as any
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  // Support batch: { batch: [{agent_id, metric, target, period_type, period_start, period_end}, ...] }
  if (data.batch && Array.isArray(data.batch)) {
    try {
      let created = 0
      for (const item of data.batch) {
        const id = generateId()
        await db.prepare(`
          INSERT INTO agent_objectives (id, org_id, agent_id, period_type, period_start, period_end, metric, target)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, orgId, item.agent_id, item.period_type || 'monthly', item.period_start, item.period_end, item.metric, item.target || 0).run()
        created++
      }
      return NextResponse.json({ created })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  // Single create
  const id = generateId()
  try {
    await db.prepare(`
      INSERT INTO agent_objectives (id, org_id, agent_id, period_type, period_start, period_end, metric, target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, orgId, data.agent_id, data.period_type || 'monthly', data.period_start, data.period_end, data.metric, data.target || 0).run()
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
    await db.prepare('DELETE FROM agent_objectives WHERE id = ? AND org_id = ?').bind(id, user.org_id || 'org_mg').run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
