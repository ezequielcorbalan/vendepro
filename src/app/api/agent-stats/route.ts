import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id') || user.id
  const isAdmin = user.role === 'admin' || user.role === 'owner'

  // Non-admin can only see own stats
  const targetAgent = isAdmin ? agentId : user.id

  try {
    // Agent info
    const agent = await db.prepare('SELECT id, full_name, email, phone FROM users WHERE id = ?').bind(targetAgent).first() as any

    // Lead stats
    const leadStats = (await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN stage = 'captado' THEN 1 ELSE 0 END) as captados,
        SUM(CASE WHEN stage = 'perdido' THEN 1 ELSE 0 END) as perdidos,
        SUM(CASE WHEN stage IN ('en_tasacion','presentada') THEN 1 ELSE 0 END) as en_tasacion
      FROM leads WHERE org_id = ? AND assigned_to = ?
    `).bind(orgId, targetAgent).first()) as any || {}

    // Tasaciones stats
    const tasaStats = (await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'captada' THEN 1 ELSE 0 END) as captadas
      FROM appraisals WHERE org_id = ? AND agent_id = ?
    `).bind(orgId, targetAgent).first()) as any || {}

    // Activity by type (last 30 days)
    const actByType = (await db.prepare(`
      SELECT activity_type, COUNT(*) as count
      FROM activities WHERE org_id = ? AND agent_id = ?
      AND created_at >= datetime('now', '-30 days')
      GROUP BY activity_type
    `).bind(orgId, targetAgent).all()).results as any[]

    // Activity by month (last 6 months)
    const actByMonth = (await db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
      FROM activities WHERE org_id = ? AND agent_id = ?
      AND created_at >= datetime('now', '-6 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `).bind(orgId, targetAgent).all()).results as any[]

    // Top neighborhoods
    const topBarrios = (await db.prepare(`
      SELECT neighborhood, COUNT(*) as count FROM leads
      WHERE org_id = ? AND assigned_to = ? AND neighborhood IS NOT NULL AND neighborhood != ''
      GROUP BY neighborhood ORDER BY count DESC LIMIT 5
    `).bind(orgId, targetAgent).all()).results as any[]

    // Top operations
    const topOps = (await db.prepare(`
      SELECT operation, COUNT(*) as count FROM leads
      WHERE org_id = ? AND assigned_to = ? AND operation IS NOT NULL AND operation != ''
      GROUP BY operation ORDER BY count DESC LIMIT 5
    `).bind(orgId, targetAgent).all()).results as any[]

    // Current objectives
    const objectives = (await db.prepare(`
      SELECT * FROM agent_objectives
      WHERE org_id = ? AND agent_id = ? AND period_end >= date('now')
      ORDER BY period_start DESC
    `).bind(orgId, targetAgent).all()).results as any[]

    // Activity total this month/quarter/year
    const nowAR = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const thisMonth = `${nowAR.getFullYear()}-${String(nowAR.getMonth() + 1).padStart(2, '0')}-01`
    const thisQuarter = `${nowAR.getFullYear()}-${String(Math.floor(nowAR.getMonth() / 3) * 3 + 1).padStart(2, '0')}-01`
    const thisYear = `${nowAR.getFullYear()}-01-01`

    const periodCounts = (await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM activities WHERE org_id = ? AND agent_id = ? AND created_at >= ?) as month_count,
        (SELECT COUNT(*) FROM activities WHERE org_id = ? AND agent_id = ? AND created_at >= ?) as quarter_count,
        (SELECT COUNT(*) FROM activities WHERE org_id = ? AND agent_id = ? AND created_at >= ?) as year_count
    `).bind(orgId, targetAgent, thisMonth, orgId, targetAgent, thisQuarter, orgId, targetAgent, thisYear).first()) as any || {}

    // Conversion rates
    const convLeadTasa = leadStats.total > 0 ? Math.round(((leadStats.en_tasacion || 0) + (tasaStats.total || 0)) / leadStats.total * 100) : 0
    const convTasaCap = tasaStats.total > 0 ? Math.round((tasaStats.captadas || 0) / tasaStats.total * 100) : 0

    return NextResponse.json({
      agent,
      leads: leadStats,
      tasaciones: tasaStats,
      actByType,
      actByMonth,
      topBarrios,
      topOps,
      objectives,
      periodCounts,
      convLeadTasa,
      convTasaCap,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
