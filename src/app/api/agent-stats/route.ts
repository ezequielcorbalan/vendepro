import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id') || user.id
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const targetAgent = isAdmin ? agentId : user.id

  try {
    const agent = await db.prepare('SELECT id, full_name, role FROM users WHERE id = ? AND org_id = ?')
      .bind(targetAgent, orgId).first() as any

    // Lead stats
    const leadStats = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN stage = 'captado' THEN 1 ELSE 0 END) as captados,
        SUM(CASE WHEN stage IN ('en_tasacion','presentada','seguimiento') THEN 1 ELSE 0 END) as en_proceso,
        SUM(CASE WHEN stage = 'perdido' THEN 1 ELSE 0 END) as perdidos,
        SUM(CASE WHEN operation = 'venta' THEN 1 ELSE 0 END) as vendedores,
        SUM(CASE WHEN operation = 'alquiler' THEN 1 ELSE 0 END) as compradores
      FROM leads WHERE assigned_to = ? AND org_id = ?
    `).bind(targetAgent, orgId).first() as any

    // Activity by type — month, quarter, year
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000) // AR timezone UTC-3
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const qMonth = Math.floor(now.getMonth() / 3) * 3 + 1
    const quarterStr = `${now.getFullYear()}-${String(qMonth).padStart(2, '0')}-01`
    const yearStr = `${now.getFullYear()}-01-01`

    const actMonth = (await db.prepare(`
      SELECT activity_type, COUNT(*) as count FROM activities
      WHERE agent_id = ? AND org_id = ? AND created_at >= ? GROUP BY activity_type
    `).bind(targetAgent, orgId, monthStr).all()).results as any[]

    const actQuarter = (await db.prepare(`
      SELECT activity_type, COUNT(*) as count FROM activities
      WHERE agent_id = ? AND org_id = ? AND created_at >= ? GROUP BY activity_type
    `).bind(targetAgent, orgId, quarterStr).all()).results as any[]

    // Previous quarter for comparison
    const prevQMonth = qMonth <= 3 ? (now.getFullYear() - 1) + '-10-01' : `${now.getFullYear()}-${String(qMonth - 3).padStart(2, '0')}-01`
    const actPrevQuarter = (await db.prepare(`
      SELECT activity_type, COUNT(*) as count FROM activities
      WHERE agent_id = ? AND org_id = ? AND created_at >= ? AND created_at < ? GROUP BY activity_type
    `).bind(targetAgent, orgId, prevQMonth, quarterStr).all()).results as any[]

    const prevQuarterTotal = actPrevQuarter.reduce((s: number, a: any) => s + a.count, 0)
    const currQuarterTotal = actQuarter.reduce((s: number, a: any) => s + a.count, 0)
    const quarterComparison = {
      current: currQuarterTotal,
      previous: prevQuarterTotal,
      change: prevQuarterTotal > 0 ? Math.round(((currQuarterTotal - prevQuarterTotal) / prevQuarterTotal) * 100) : 0,
      currentByType: actQuarter,
      previousByType: actPrevQuarter,
    }

    const actYear = (await db.prepare(`
      SELECT activity_type, COUNT(*) as count FROM activities
      WHERE agent_id = ? AND org_id = ? AND created_at >= ? GROUP BY activity_type
    `).bind(targetAgent, orgId, yearStr).all()).results as any[]

    // Tasaciones
    let tasacionStats = { total: 0, presentadas: 0, captadas: 0 }
    try {
      const ts = await db.prepare(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN status IN ('presentada','captada') THEN 1 ELSE 0 END) as presentadas,
          SUM(CASE WHEN status = 'captada' THEN 1 ELSE 0 END) as captadas
        FROM appraisals WHERE agent_id = ? AND org_id = ?
      `).bind(targetAgent, orgId).first() as any
      tasacionStats = { total: ts?.total || 0, presentadas: ts?.presentadas || 0, captadas: ts?.captadas || 0 }
    } catch { /* */ }

    // Properties
    let propertyStats = { captadas: 0, publicadas: 0, reservadas: 0, vendidas: 0 }
    try {
      const ps = await db.prepare(`
        SELECT
          SUM(CASE WHEN commercial_stage='captada' THEN 1 ELSE 0 END) as captadas,
          SUM(CASE WHEN commercial_stage='publicada' THEN 1 ELSE 0 END) as publicadas,
          SUM(CASE WHEN commercial_stage='reservada' THEN 1 ELSE 0 END) as reservadas,
          SUM(CASE WHEN commercial_stage='vendida' THEN 1 ELSE 0 END) as vendidas
        FROM properties WHERE agent_id = ? AND org_id = ?
      `).bind(targetAgent, orgId).first() as any
      propertyStats = { captadas: ps?.captadas || 0, publicadas: ps?.publicadas || 0, reservadas: ps?.reservadas || 0, vendidas: ps?.vendidas || 0 }
    } catch { /* */ }

    // Top neighborhoods
    const topBarrios = (await db.prepare(`
      SELECT neighborhood, COUNT(*) as count FROM leads
      WHERE assigned_to = ? AND org_id = ? AND neighborhood IS NOT NULL AND neighborhood != ''
      GROUP BY neighborhood ORDER BY count DESC LIMIT 5
    `).bind(targetAgent, orgId).all()).results as any[]

    // Weekly trend (8 weeks)
    const weeklyTrend = (await db.prepare(`
      SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
      FROM activities WHERE agent_id = ? AND org_id = ? AND created_at >= datetime('now','-56 days')
      GROUP BY week ORDER BY week ASC
    `).bind(targetAgent, orgId).all()).results as any[]

    // Objectives
    let objectives: any[] = []
    try {
      objectives = (await db.prepare(`
        SELECT * FROM agent_objectives WHERE agent_id = ? AND org_id = ? AND period_end >= date('now')
        ORDER BY period_start ASC
      `).bind(targetAgent, orgId).all()).results as any[]
    } catch { /* */ }

    // Conversions
    const totalL = leadStats?.total || 0
    const captL = leadStats?.captados || 0
    const convLT = totalL > 0 ? Math.round((tasacionStats.total / totalL) * 100) : 0
    const convTC = tasacionStats.total > 0 ? Math.round((tasacionStats.captadas / tasacionStats.total) * 100) : 0
    const convLC = totalL > 0 ? Math.round((captL / totalL) * 100) : 0

    return NextResponse.json({
      agent, leadStats,
      activityMonth: actMonth, activityQuarter: actQuarter, activityYear: actYear,
      quarterComparison,
      tasacionStats, propertyStats, topBarrios, weeklyTrend, objectives,
      conversions: { leadTasacion: convLT, tasacionCaptacion: convTC, leadCaptacion: convLC }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
