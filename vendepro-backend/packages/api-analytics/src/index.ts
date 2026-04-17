import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1LeadRepository, D1PropertyRepository, D1ReservationRepository, D1CalendarRepository, D1AnalyticsReportRepository, D1ActivityRepository, D1AppraisalRepository, D1ContactRepository, D1ObjectiveRepository, D1UserRepository, JwtAuthService } from '@vendepro/infrastructure'
import {
  GetDashboardStatsUseCase,
  GetAppraisalStatsUseCase,
  GetActivityStatsUseCase,
  GetTodayEventsUseCase,
  GetPendingFollowupsUseCase,
  GetAgentStatsUseCase,
  SearchEntitiesUseCase,
  ExportLeadsUseCase,
  GetListingsPerformanceUseCase,
  ListReportsWithMetricsUseCase,
  GetNeighborhoodComparisonUseCase,
  GetActiveListingsWithBenchmarkUseCase,
  parseAnalyticsPeriod,
  computeLeadFunnel,
  computeConversionRate,
} from '@vendepro/core'

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

  const [base, tasaciones, activity, todayEvents, pendingFollowups] = await Promise.all([
    new GetDashboardStatsUseCase(
      new D1LeadRepository(db),
      new D1PropertyRepository(db),
      new D1ReservationRepository(db),
      new D1CalendarRepository(db),
    ).execute(orgId, agent_id),
    new GetAppraisalStatsUseCase(new D1AppraisalRepository(db)).execute(orgId),
    new GetActivityStatsUseCase(new D1ActivityRepository(db)).execute(orgId, agent_id),
    new GetTodayEventsUseCase(new D1CalendarRepository(db)).execute(orgId),
    new GetPendingFollowupsUseCase(new D1LeadRepository(db)).execute(orgId),
  ])

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

  const funnel = computeLeadFunnel(sb, base.totalLeads)
  const conversionRate = computeConversionRate(sb, base.totalLeads)

  return c.json({
    leads,
    overdueLeads: base.urgentLeads,
    tasaciones,
    activity: activity.summary,
    weeklyActivity: activity.weekly,
    recentActivities: activity.recent,
    todayEvents,
    pendingFollowups,
    agentPerformance: [],
    funnel,
    conversionRate,
    pipelineBreakdown: sb,
  })
})

app.get('/search', async (c) => {
  const { q } = c.req.query()
  if (!q || q.length < 2) return c.json([])
  const db = c.env.DB
  const orgId = c.get('orgId')

  const results = await new SearchEntitiesUseCase(
    new D1LeadRepository(db),
    new D1ContactRepository(db),
    new D1PropertyRepository(db),
  ).execute(orgId, q, 5)

  return c.json(results)
})

app.get('/agent-stats', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const agentId = c.get('userId')

  const stats = await new GetAgentStatsUseCase(
    new D1UserRepository(db),
    new D1LeadRepository(db),
    new D1AppraisalRepository(db),
    new D1ActivityRepository(db),
    new D1ObjectiveRepository(db),
    new D1PropertyRepository(db),
  ).execute(orgId, agentId)

  return c.json(stats)
})

app.get('/export', async (c) => {
  const { type } = c.req.query()
  const db = c.env.DB
  const orgId = c.get('orgId')

  if (type === 'leads') {
    const rows = await new ExportLeadsUseCase(new D1LeadRepository(db)).execute(orgId)
    return c.json(rows)
  }

  return c.json({ error: 'Unknown export type' }, 400)
})

// ── LISTINGS PERFORMANCE ──────────────────────────────────────
// KPIs agregados, ranking por barrio y timeline mensual sobre los
// reportes publicados de la org.

app.get('/listings-performance', async (c) => {
  const period = parseAnalyticsPeriod(c.req.query('period'))
  const source = c.req.query('source') ?? null
  const orgId = c.get('orgId')

  const priceMinRaw = c.req.query('price_min')
  const priceMaxRaw = c.req.query('price_max')
  const listingFilters = {
    property_type: c.req.query('property_type') ?? null,
    price_min: priceMinRaw ? parseFloat(priceMinRaw) : null,
    price_max: priceMaxRaw ? parseFloat(priceMaxRaw) : null,
  }

  const repo = new D1AnalyticsReportRepository(c.env.DB)
  const performance = new GetListingsPerformanceUseCase(repo)
  const comparison = new GetNeighborhoodComparisonUseCase(repo)
  const activeListings = new GetActiveListingsWithBenchmarkUseCase(repo)

  const [baseResult, comparisonResult, activeListingsResult] = await Promise.all([
    performance.execute({ orgId, period, source, listingFilters }),
    comparison.execute(orgId, listingFilters),
    activeListings.execute(orgId, listingFilters),
  ])

  return c.json({
    ...baseResult,
    comparison_by_neighborhood: comparisonResult,
    active_listings: activeListingsResult,
  })
})

// ── REPORTS LIST ──────────────────────────────────────────────
// Listado paginado con métricas agregadas.

app.get('/reports', async (c) => {
  const orgId = c.get('orgId')

  const page = parseInt(c.req.query('page') ?? '1', 10) || 1
  const pageSize = parseInt(c.req.query('page_size') ?? '20', 10) || 20

  const useCase = new ListReportsWithMetricsUseCase(new D1AnalyticsReportRepository(c.env.DB))
  const data = await useCase.execute(orgId, {
    page,
    page_size: pageSize,
    neighborhood: c.req.query('neighborhood') ?? null,
    status: c.req.query('status') ?? null,
    property_id: c.req.query('property_id') ?? null,
    from: c.req.query('from') ?? null,
    to: c.req.query('to') ?? null,
  })

  return c.json({
    page,
    page_size: pageSize,
    total: data.total,
    results: data.results,
  })
})

export default app
