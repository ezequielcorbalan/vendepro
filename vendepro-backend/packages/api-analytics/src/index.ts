import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1LeadRepository, D1PropertyRepository, D1ReservationRepository, D1CalendarRepository, JwtAuthService } from '@vendepro/infrastructure'
import { GetDashboardStatsUseCase } from '@vendepro/core'
import {
  periodStartDate,
  getPerformanceKpis,
  getNeighborhoodPerformance,
  getTimelinePerformance,
  listReportsWithMetrics,
  getComparisonByNeighborhood,
  BENCHMARKS,
  type Period,
} from './reports-queries'

type Env = { DB: D1Database; JWT_SECRET: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.use('*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

app.get('/dashboard', async (c) => {
  const { agent_id } = c.req.query()
  const db = c.env.DB
  const orgId = c.get('orgId')

  const useCase = new GetDashboardStatsUseCase(
    new D1LeadRepository(db),
    new D1PropertyRepository(db),
    new D1ReservationRepository(db),
    new D1CalendarRepository(db),
  )
  const base = await useCase.execute(orgId, agent_id)

  // ── Leads by stage ────────────────────────────────────────────
  const sb = base.stageBreakdown
  const leads = {
    total: base.totalLeads,
    nuevo: sb['nuevo'] ?? 0,
    asignado: sb['asignado'] ?? 0,
    contactados: sb['contactado'] ?? 0,
    calificados: sb['calificado'] ?? 0,
    en_tasacion: sb['en_tasacion'] ?? 0,
    presentados: sb['presentada'] ?? 0,
    seguimiento: sb['seguimiento'] ?? 0,
    captados: sb['captado'] ?? 0,
    perdidos: sb['perdido'] ?? 0,
    archivados: sb['archivado'] ?? 0,
  }

  // ── Funnel ────────────────────────────────────────────────────
  const funnelStages = [
    { key: 'nuevo', label: 'Nuevo' },
    { key: 'contactado', label: 'Contactado' },
    { key: 'calificado', label: 'Calificado' },
    { key: 'en_tasacion', label: 'En tasación' },
    { key: 'presentada', label: 'Presentada' },
    { key: 'captado', label: 'Captado' },
  ]
  const funnel = funnelStages.map(s => ({
    stage: s.key,
    label: s.label,
    count: sb[s.key] ?? 0,
    pct: base.totalLeads > 0 ? Math.round(((sb[s.key] ?? 0) / base.totalLeads) * 100) : 0,
  }))

  // ── Conversion rate ───────────────────────────────────────────
  const conversionRate = base.totalLeads > 0
    ? Math.round(((sb['captado'] ?? 0) / base.totalLeads) * 100)
    : 0

  // ── Overdue leads (urgent) ────────────────────────────────────
  const overdueLeads = base.urgentLeads

  // ── Tasaciones from DB ────────────────────────────────────────
  let tasaciones = { total: 0, captadas: 0 }
  try {
    const [totalRow, captadasRow] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM appraisals WHERE org_id = ?`).bind(orgId).first() as Promise<any>,
      db.prepare(`SELECT COUNT(*) as cnt FROM appraisals WHERE org_id = ? AND stage = 'captado'`).bind(orgId).first() as Promise<any>,
    ])
    tasaciones = { total: totalRow?.cnt ?? 0, captadas: captadasRow?.cnt ?? 0 }
  } catch { /* appraisals table may not exist yet */ }

  // ── Activity stats (last 30 days) ─────────────────────────────
  let activity = { total: 0, llamadas: 0, reuniones: 0, visitas: 0 }
  let weeklyActivity: { day: string; count: number }[] = []
  let recentActivities: any[] = []
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const agentFilter = agent_id ? ' AND agent_id = ?' : ''
    const agentBinds: unknown[] = agent_id ? [orgId, thirtyDaysAgo, agent_id] : [orgId, thirtyDaysAgo]

    const acts = (await db.prepare(
      `SELECT activity_type, created_at FROM activities WHERE org_id = ? AND created_at >= ?${agentFilter} LIMIT 500`
    ).bind(...agentBinds).all()).results as any[]

    activity = {
      total: acts.length,
      llamadas: acts.filter((a: any) => a.activity_type === 'llamada').length,
      reuniones: acts.filter((a: any) => a.activity_type === 'reunion').length,
      visitas: acts.filter((a: any) => ['visita_captacion', 'visita_comprador'].includes(a.activity_type)).length,
    }

    // Weekly activity (last 7 days)
    const dayMap: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      dayMap[d.toISOString().split('T')[0]] = 0
    }
    acts.forEach((a: any) => {
      const day = (a.created_at as string).split('T')[0]
      if (day in dayMap) dayMap[day]++
    })
    weeklyActivity = Object.entries(dayMap).map(([day, count]) => ({ day, count }))

    // Recent activities (last 5)
    recentActivities = (await db.prepare(
      `SELECT a.*, u.full_name as agent_name FROM activities a LEFT JOIN users u ON a.agent_id = u.id WHERE a.org_id = ? ORDER BY a.created_at DESC LIMIT 5`
    ).bind(orgId).all()).results as any[]
  } catch { /* activities table may not exist yet */ }

  // ── Today's events ────────────────────────────────────────────
  let todayEvents: any[] = []
  try {
    const today = new Date().toISOString().split('T')[0]
    todayEvents = (await db.prepare(
      `SELECT * FROM calendar_events WHERE org_id = ? AND date(start_at) = ? AND status != 'cancelled' ORDER BY start_at ASC LIMIT 20`
    ).bind(orgId, today).all()).results as any[]
  } catch { /* calendar_events table may not exist yet */ }

  // ── Pending followups ─────────────────────────────────────────
  let pendingFollowups: any[] = []
  try {
    const now = new Date().toISOString()
    pendingFollowups = (await db.prepare(
      `SELECT id, full_name, next_step, next_step_date, stage FROM leads WHERE org_id = ? AND next_step_date <= ? AND stage NOT IN ('captado','perdido','archivado') ORDER BY next_step_date ASC LIMIT 10`
    ).bind(orgId, now).all()).results as any[]
  } catch { /* leads table may not exist yet */ }

  // ── Pipeline breakdown for dashboard ─────────────────────────
  const pipelineBreakdown = Object.fromEntries(
    Object.entries(sb).map(([k, v]) => [k, v])
  )

  return c.json({
    leads,
    overdueLeads,
    tasaciones,
    activity,
    weeklyActivity,
    todayEvents,
    pendingFollowups,
    agentPerformance: [],
    funnel,
    conversionRate,
    recentActivities,
    pipelineBreakdown,
  })
})

app.get('/search', async (c) => {
  const { q } = c.req.query()
  if (!q || q.length < 2) return c.json([])
  const db = c.env.DB
  const orgId = c.get('orgId')
  const like = `%${q}%`

  const [leads, contacts, properties] = await Promise.all([
    db.prepare(`SELECT 'lead' as type, id, full_name as label FROM leads WHERE org_id = ? AND full_name LIKE ? LIMIT 5`).bind(orgId, like).all(),
    db.prepare(`SELECT 'contact' as type, id, full_name as label FROM contacts WHERE org_id = ? AND full_name LIKE ? LIMIT 5`).bind(orgId, like).all(),
    db.prepare(`SELECT 'property' as type, id, address as label FROM properties WHERE org_id = ? AND address LIKE ? LIMIT 5`).bind(orgId, like).all(),
  ])

  return c.json([
    ...(leads.results as any[]),
    ...(contacts.results as any[]),
    ...(properties.results as any[]),
  ])
})

app.get('/agent-stats', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const agentId = c.get('userId')

  const now = new Date()
  const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1)
  const quarterAgo = new Date(now); quarterAgo.setMonth(quarterAgo.getMonth() - 3)
  const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1)

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => { try { return await fn() } catch { return fallback } }

  const [agentRow, leadStats, tasStats, actMonth, actQuarter, actYear, objectives, propStats] = await Promise.all([
    safe(() => db.prepare(`SELECT full_name FROM users WHERE id = ?`).bind(agentId).first() as Promise<any>, null),
    safe(() => db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN stage='captado' THEN 1 ELSE 0 END) as captados FROM leads WHERE org_id=? AND assigned_to=?`).bind(orgId, agentId).first() as Promise<any>, null),
    safe(() => db.prepare(`SELECT COUNT(*) as total FROM appraisals WHERE org_id=? AND agent_id=?`).bind(orgId, agentId).first() as Promise<any>, null),
    safe(() => db.prepare(`SELECT activity_type, COUNT(*) as count FROM activities WHERE org_id=? AND agent_id=? AND created_at>=? GROUP BY activity_type`).bind(orgId, agentId, monthAgo.toISOString()).all(), { results: [] }),
    safe(() => db.prepare(`SELECT activity_type, COUNT(*) as count FROM activities WHERE org_id=? AND agent_id=? AND created_at>=? GROUP BY activity_type`).bind(orgId, agentId, quarterAgo.toISOString()).all(), { results: [] }),
    safe(() => db.prepare(`SELECT activity_type, COUNT(*) as count FROM activities WHERE org_id=? AND agent_id=? AND created_at>=? GROUP BY activity_type`).bind(orgId, agentId, yearAgo.toISOString()).all(), { results: [] }),
    safe(() => db.prepare(`SELECT * FROM agent_objectives WHERE org_id=? AND agent_id=? AND is_active=1 ORDER BY created_at DESC LIMIT 10`).bind(orgId, agentId).all(), { results: [] }),
    safe(() => db.prepare(`SELECT SUM(CASE WHEN status='captada' THEN 1 ELSE 0 END) as captadas, SUM(CASE WHEN status='publicada' THEN 1 ELSE 0 END) as publicadas, SUM(CASE WHEN status='reservada' THEN 1 ELSE 0 END) as reservadas, SUM(CASE WHEN status='vendida' THEN 1 ELSE 0 END) as vendidas FROM properties WHERE org_id=? AND agent_id=?`).bind(orgId, agentId).first() as Promise<any>, null),
  ])

  const total = (leadStats as any)?.total ?? 0
  const captados = (leadStats as any)?.captados ?? 0
  const totalTas = (tasStats as any)?.total ?? 0
  const conversions = {
    leadTasacion: total > 0 ? Math.round((totalTas / total) * 100) : 0,
    tasacionCaptacion: totalTas > 0 ? Math.round((captados / totalTas) * 100) : 0,
    leadCaptacion: total > 0 ? Math.round((captados / total) * 100) : 0,
  }

  return c.json({
    agent: agentRow ?? { full_name: 'Agente' },
    leadStats: { total, captados },
    tasacionStats: { total: totalTas },
    activityMonth: (actMonth as any).results ?? [],
    activityQuarter: (actQuarter as any).results ?? [],
    activityYear: (actYear as any).results ?? [],
    conversions,
    objectives: (objectives as any).results ?? [],
    propertyStats: propStats ?? { captadas: 0, publicadas: 0, reservadas: 0, vendidas: 0 },
  })
})

app.get('/export', async (c) => {
  const { type } = c.req.query()
  const db = c.env.DB
  const orgId = c.get('orgId')

  if (type === 'leads') {
    const rows = (await db.prepare(`SELECT l.*, u.full_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.org_id = ? ORDER BY l.created_at DESC`).bind(orgId).all()).results
    return c.json(rows)
  }

  return c.json({ error: 'Unknown export type' }, 400)
})

// ── LISTINGS PERFORMANCE ──────────────────────────────────────
// Aggregated metrics across all published reports for the org.
// Returns: KPIs, by_neighborhood ranking, and monthly timeline.

app.get('/listings-performance', async (c) => {
  const rawPeriod = c.req.query('period') ?? 'month'
  const period: Period = (['week', 'month', 'quarter', 'year'] as const).includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : 'month'
  const source = c.req.query('source') ?? null

  const db = c.env.DB
  const orgId = c.get('orgId')
  const now = new Date()
  const end = now.toISOString().split('T')[0] ?? ''
  const start = periodStartDate(period, now)

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch { return fallback }
  }

  const emptyKpis = {
    reports_published: 0,
    total_impressions: 0,
    total_portal_visits: 0,
    total_in_person_visits: 0,
    total_offers: 0,
    avg_impressions_per_report: 0,
    avg_portal_visits_per_report: 0,
    avg_in_person_visits_per_report: 0,
    avg_offers_per_report: 0,
    avg_views_per_day: 0,
    avg_in_person_visits_per_week: 0,
    overall_health_status: 'red' as const,
  }

  const [kpis, byNeighborhood, timeline, comparison] = await Promise.all([
    safe(() => getPerformanceKpis(db, orgId, start, end, source), emptyKpis),
    safe(() => getNeighborhoodPerformance(db, orgId, start, end, source), [] as Awaited<ReturnType<typeof getNeighborhoodPerformance>>),
    safe(() => getTimelinePerformance(db, orgId, start, end, source), [] as Awaited<ReturnType<typeof getTimelinePerformance>>),
    safe(() => getComparisonByNeighborhood(db, orgId), [] as Awaited<ReturnType<typeof getComparisonByNeighborhood>>),
  ])

  return c.json({
    period,
    start,
    end,
    kpis,
    by_neighborhood: byNeighborhood,
    timeline,
    benchmarks: BENCHMARKS,
    comparison_by_neighborhood: comparison,
  })
})

// ── REPORTS LIST (global, across properties) ──────────────────
// Paginated list of all reports in the org with aggregated metrics.

app.get('/reports', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')

  const page = parseInt(c.req.query('page') ?? '1', 10) || 1
  const pageSize = parseInt(c.req.query('page_size') ?? '20', 10) || 20
  const neighborhood = c.req.query('neighborhood') ?? null
  const status = c.req.query('status') ?? null
  const propertyId = c.req.query('property_id') ?? null
  const from = c.req.query('from') ?? null
  const to = c.req.query('to') ?? null

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch { return fallback }
  }

  const data = await safe(
    () => listReportsWithMetrics(db, orgId, {
      page,
      page_size: pageSize,
      neighborhood,
      status,
      property_id: propertyId,
      from,
      to,
    }),
    { total: 0, results: [] as Awaited<ReturnType<typeof listReportsWithMetrics>>['results'] },
  )

  return c.json({
    page,
    page_size: pageSize,
    total: data.total,
    results: data.results,
  })
})

export default app
