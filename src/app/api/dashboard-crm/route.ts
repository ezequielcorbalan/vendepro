import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

function getARDate() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000)
}

function getPeriodStart(period: string): string {
  const now = getARDate()
  const y = now.getFullYear(), m = now.getMonth()
  switch (period) {
    case 'week': { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0] }
    case 'quarter': { const qm = Math.floor(m / 3) * 3; return `${y}-${String(qm + 1).padStart(2, '0')}-01` }
    case 'year': return `${y}-01-01`
    default: return `${y}-${String(m + 1).padStart(2, '0')}-01` // month
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const period = new URL(request.url).searchParams.get('period') || 'month'
  const periodStart = getPeriodStart(period)

  try {
    // ── KPIs de Leads (filtrado por período de creación) ──
    const agentFilter = isAdmin ? '' : ' AND l.assigned_to = ?'
    const agentBinds = isAdmin ? [orgId] : [orgId, user.id]

    const leadStats = (await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN stage = 'nuevo' THEN 1 ELSE 0 END) as nuevos,
        SUM(CASE WHEN stage = 'asignado' THEN 1 ELSE 0 END) as asignados,
        SUM(CASE WHEN stage = 'contactado' THEN 1 ELSE 0 END) as contactados,
        SUM(CASE WHEN stage = 'calificado' THEN 1 ELSE 0 END) as calificados,
        SUM(CASE WHEN stage = 'seguimiento' THEN 1 ELSE 0 END) as seguimiento,
        SUM(CASE WHEN stage = 'en_tasacion' THEN 1 ELSE 0 END) as en_tasacion,
        SUM(CASE WHEN stage = 'presentada' THEN 1 ELSE 0 END) as presentada,
        SUM(CASE WHEN stage = 'captado' THEN 1 ELSE 0 END) as captados,
        SUM(CASE WHEN stage = 'perdido' THEN 1 ELSE 0 END) as perdidos
      FROM leads l WHERE l.org_id = ?${agentFilter}
    `).bind(...agentBinds).first()) as any || {}

    // ── Leads vencidos (>24h nuevo sin contactar, >7 días sin actualizar) ──
    const overdueLeads = (await db.prepare(`
      SELECT COUNT(*) as count FROM leads l
      WHERE l.org_id = ? AND l.stage NOT IN ('captado', 'perdido')
      AND (
        (l.stage = 'nuevo' AND l.created_at < datetime('now', '-24 hours'))
        OR l.updated_at < datetime('now', '-7 days')
      )${agentFilter}
    `).bind(...agentBinds).first()) as any

    // ── Tasaciones stats ──
    const tasacionStats = (await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completada' OR status = 'presentada' THEN 1 ELSE 0 END) as presentadas,
        SUM(CASE WHEN status = 'captada' THEN 1 ELSE 0 END) as captadas
      FROM appraisals WHERE org_id = ?${isAdmin ? '' : ' AND agent_id = ?'}
    `).bind(...(isAdmin ? [orgId] : [orgId, user.id])).first()) as any || {}

    // ── Actividad del período seleccionado ──
    const activityStats = (await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN activity_type = 'llamada' THEN 1 ELSE 0 END) as llamadas,
        SUM(CASE WHEN activity_type = 'reunion' THEN 1 ELSE 0 END) as reuniones,
        SUM(CASE WHEN activity_type IN ('visita_captacion', 'visita_comprador') THEN 1 ELSE 0 END) as visitas,
        SUM(CASE WHEN activity_type = 'tasacion' THEN 1 ELSE 0 END) as tasaciones,
        SUM(CASE WHEN activity_type = 'seguimiento' THEN 1 ELSE 0 END) as seguimientos
      FROM activities WHERE org_id = ?
      AND created_at >= ?
      ${isAdmin ? '' : 'AND agent_id = ?'}
    `).bind(...(isAdmin ? [orgId, periodStart] : [orgId, periodStart, user.id])).first()) as any || {}

    // ── Actividad por día (del período seleccionado, max 30 days for chart) ──
    const chartDays = period === 'week' ? 7 : period === 'year' ? 30 : period === 'quarter' ? 14 : 30
    const weeklyActivity = (await db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM activities WHERE org_id = ?
      AND created_at >= datetime('now', '-${chartDays} days')
      ${isAdmin ? '' : 'AND agent_id = ?'}
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).bind(...(isAdmin ? [orgId] : [orgId, user.id])).all()).results as any[]

    // ── Eventos de hoy (Argentina UTC-3) ──
    const today = getARDate().toISOString().split('T')[0]
    const todayEvents = (await db.prepare(`
      SELECT e.*, u.full_name as agent_name,
        l.full_name as lead_name, c.full_name as contact_name
      FROM calendar_events e
      LEFT JOIN users u ON e.agent_id = u.id
      LEFT JOIN leads l ON e.lead_id = l.id
      LEFT JOIN contacts c ON e.contact_id = c.id
      WHERE e.org_id = ? AND e.start_at >= ? AND e.start_at < ?
      ${isAdmin ? '' : 'AND e.agent_id = ?'}
      ORDER BY e.start_at ASC LIMIT 10
    `).bind(...(isAdmin ? [orgId, today + 'T00:00:00', today + 'T23:59:59'] : [orgId, today + 'T00:00:00', today + 'T23:59:59', user.id])).all()).results as any[]

    // ── Seguimientos pendientes (próximos 7 días) ──
    const pendingFollowups = (await db.prepare(`
      SELECT l.id, l.full_name, l.phone, l.next_step, l.next_step_date, l.stage,
        u.full_name as agent_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.org_id = ? AND l.next_step IS NOT NULL AND l.next_step != ''
      AND l.stage NOT IN ('captado', 'perdido')
      ${isAdmin ? '' : 'AND l.assigned_to = ?'}
      ORDER BY l.next_step_date ASC NULLS LAST LIMIT 10
    `).bind(...(isAdmin ? [orgId] : [orgId, user.id])).all()).results as any[]

    // ── Performance por agente (solo admin) ──
    let agentPerformance: any[] = []
    if (isAdmin) {
      agentPerformance = (await db.prepare(`
        SELECT
          u.id, u.full_name,
          (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND org_id = ?) as total_leads,
          (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND org_id = ? AND stage = 'captado') as captados,
          (SELECT COUNT(*) FROM activities WHERE agent_id = u.id AND org_id = ? AND created_at >= ?) as actividad_mes
        FROM users u WHERE u.org_id = ? AND u.role IN ('admin', 'agent', 'owner')
        ORDER BY actividad_mes DESC
      `).bind(orgId, orgId, orgId, periodStart, orgId).all()).results as any[]
    }

    // ── Reservas y Vendidas ──
    let reservadosCount = 0
    let vendidosCount = 0
    try {
      const reservas = (await db.prepare(
        `SELECT COUNT(*) as count FROM reservations WHERE org_id = ? AND status NOT IN ('cancelled', 'rejected')`
      ).bind(orgId).first()) as any
      reservadosCount = reservas?.count || 0
    } catch { /* table may not exist */ }
    try {
      const vendidas = (await db.prepare(
        `SELECT COUNT(*) as count FROM properties WHERE org_id = ? AND status = 'sold'`
      ).bind(orgId).first()) as any
      // Also count sold_properties
      const soldProps = (await db.prepare(
        `SELECT COUNT(*) as count FROM sold_properties WHERE agent_id IN (SELECT id FROM users WHERE org_id = ?)`
      ).bind(orgId).first()) as any
      vendidosCount = (vendidas?.count || 0) + (soldProps?.count || 0)
    } catch { /* tables may not exist */ }

    // ── Property commercial stage counts ──
    let propPublicadas = 0
    try {
      const pc = (await db.prepare(`SELECT COUNT(*) as c FROM properties WHERE org_id = ? AND commercial_stage = 'publicada'`).bind(orgId).first()) as any
      propPublicadas = pc?.c || 0
    } catch { /* column may not exist */ }

    // ── Funnel de conversión — Pipeline A (lead→captado) + Pipeline B (propiedad captada→vendida) ──
    const funnel = [
      { stage: 'Leads totales', count: leadStats.total || 0 },
      { stage: 'Contactados', count: (leadStats.contactados || 0) + (leadStats.calificados || 0) + (leadStats.en_tasacion || 0) + (leadStats.presentada || 0) + (leadStats.seguimiento || 0) + (leadStats.captados || 0) },
      { stage: 'Calificados', count: (leadStats.calificados || 0) + (leadStats.en_tasacion || 0) + (leadStats.presentada || 0) + (leadStats.seguimiento || 0) + (leadStats.captados || 0) },
      { stage: 'En tasación', count: (leadStats.en_tasacion || 0) + (leadStats.presentada || 0) + (leadStats.seguimiento || 0) + (leadStats.captados || 0) },
      { stage: 'Presentada', count: (leadStats.presentada || 0) + (leadStats.seguimiento || 0) + (leadStats.captados || 0) },
      { stage: 'Captados', count: leadStats.captados || 0 },
      { stage: 'Publicadas', count: propPublicadas },
      { stage: 'Reservados', count: reservadosCount },
      { stage: 'Vendidos', count: vendidosCount },
    ]

    const conversionRate = leadStats.total > 0
      ? Math.round(((leadStats.captados || 0) / leadStats.total) * 100)
      : 0

    return NextResponse.json({
      period, periodStart,
      leads: leadStats,
      overdueLeads: overdueLeads?.count || 0,
      tasaciones: tasacionStats,
      activity: activityStats,
      weeklyActivity,
      todayEvents,
      pendingFollowups,
      agentPerformance,
      funnel,
      conversionRate,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
