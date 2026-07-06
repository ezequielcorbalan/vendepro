import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1LeadRepository, D1PropertyRepository, D1ReservationRepository, D1CalendarRepository, D1AnalyticsReportRepository, D1ActivityRepository, D1AppraisalRepository, D1ContactRepository, D1ObjectiveRepository, D1UserRepository, D1MetaIntegrationRepository, JwtAuthService, MetaAdsInsightsHttp, decrypt } from '@vendepro/infrastructure'
import {
  GetCampaignInsightsUseCase,
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
  periodStartDate,
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

// Traduce el período del funnel a una fecha de inicio (ISO date) o undefined.
// Soporta ventanas móviles (week/month/quarter/year) y calendario (cal_*).
function funnelSince(raw: string | undefined): string | undefined {
  if (!raw || raw === 'all') return undefined
  const now = new Date()
  const iso = (d: Date) => d.toISOString().split('T')[0] ?? ''
  switch (raw) {
    case 'cal_week': {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      return iso(d)
    }
    case 'cal_month':
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
    case 'cal_quarter': {
      const q = Math.floor(now.getUTCMonth() / 3) * 3
      return `${now.getUTCFullYear()}-${String(q + 1).padStart(2, '0')}-01`
    }
    case 'cal_year':
      return `${now.getUTCFullYear()}-01-01`
    default:
      // week/month/quarter/year (y cualquier otro) → ventana móvil
      return periodStartDate(parseAnalyticsPeriod(raw))
  }
}

app.get('/dashboard', async (c) => {
  const { agent_id } = c.req.query()
  const db = c.env.DB
  const orgId = c.get('orgId')

  // Período que acota SOLO el funnel. Soporta:
  //  - 'all'                              → toda la historia
  //  - 'week'|'month'|'quarter'|'year'    → ventana móvil (últimos 7/30/90/365 días)
  //  - 'cal_week'|'cal_month'|'cal_quarter'|'cal_year' → período calendario en curso
  const since = funnelSince(c.req.query('period'))

  const [base, tasaciones, activity, todayEvents, pendingFollowups] = await Promise.all([
    new GetDashboardStatsUseCase(
      new D1LeadRepository(db),
      new D1PropertyRepository(db),
      new D1ReservationRepository(db),
      new D1CalendarRepository(db),
    ).execute(orgId, agent_id, since),
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

  // Funnel: acotado al período. KPIs y conversión: toda la historia.
  const funnel = computeLeadFunnel(base.funnelStageBreakdown, base.funnelTotalLeads)
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

// ── MARKETING DASHBOARD ──────────────────────────────────────

function marketingFromDate(period: string): string {
  const now = new Date()
  if (period === 'quarter') {
    const q = new Date(now); q.setMonth(q.getMonth() - 3)
    return q.toISOString().slice(0, 10)
  }
  if (period === 'year') return `${now.getFullYear()}-01-01`
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

app.get('/marketing', async (c) => {
  const orgId = c.get('orgId')
  const db = c.env.DB
  const period = c.req.query('period') ?? 'month'
  const fromDate = marketingFromDate(period)

  const [leadsBySource, leadsByDay, stageBreakdown, metaEvents, metaIntegration] = await Promise.all([
    db.prepare(`SELECT source, COUNT(*) as count FROM leads WHERE org_id = ? AND created_at >= ? GROUP BY source ORDER BY count DESC`).bind(orgId, fromDate).all(),
    db.prepare(`SELECT substr(created_at, 1, 10) as day, COUNT(*) as count FROM leads WHERE org_id = ? AND created_at >= ? GROUP BY day ORDER BY day ASC`).bind(orgId, fromDate).all(),
    db.prepare(`SELECT stage, COUNT(*) as count FROM leads WHERE org_id = ? AND created_at >= ? GROUP BY stage`).bind(orgId, fromDate).all(),
    db.prepare(`SELECT event_name, status, COUNT(*) as count FROM meta_event_log WHERE org_id = ? GROUP BY event_name, status`).bind(orgId).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT enabled, pixel_id, ga4_enabled, ga4_measurement_id FROM meta_integration WHERE org_id = ?`).bind(orgId).first().catch(() => null),
  ])

  const sb: Record<string, number> = {}
  for (const r of (stageBreakdown.results as any[])) sb[r.stage] = r.count
  const totalLeads = Object.values(sb).reduce((a, b) => a + b, 0)
  const funnel = computeLeadFunnel(sb, totalLeads)
  const conversionRate = computeConversionRate(sb, totalLeads)

  const eventMap: Record<string, { sent: number; failed: number }> = {}
  for (const r of (metaEvents.results as any[])) {
    if (!eventMap[r.event_name]) eventMap[r.event_name] = { sent: 0, failed: 0 }
    if (r.status === 'sent') eventMap[r.event_name].sent += r.count
    else if (r.status === 'failed') eventMap[r.event_name].failed += r.count
  }

  return c.json({
    period, from: fromDate, totalLeads, conversionRate, funnel,
    leadsBySource: leadsBySource.results,
    leadsByDay: leadsByDay.results,
    metaEvents: eventMap,
    integration: {
      meta: { enabled: !!metaIntegration && (metaIntegration as any).enabled === 1, pixelId: (metaIntegration as any)?.pixel_id ?? null },
      ga4: { enabled: !!metaIntegration && (metaIntegration as any).ga4_enabled === 1, measurementId: (metaIntegration as any)?.ga4_measurement_id ?? null },
    },
  })
})

// ── MARKETING — CAMPAÑAS META ADS ────────────────────────────
// Insights por campaña (Marketing API) cruzados con leads del CRM.
// La atribución matchea leads.source_detail (campaña de la landing)
// contra el nombre de campaña en Meta, case-insensitive.

const QUALIFIED_STAGES = new Set(['calificado', 'en_tasacion', 'presentada', 'seguimiento', 'captado'])
const CAMPAIGNS_CACHE_SECONDS = 900 // Meta Insights ratelimitea agresivo

app.get('/marketing/campaigns', async (c) => {
  const orgId = c.get('orgId')
  const db = c.env.DB
  const period = c.req.query('period') ?? 'month'
  const fromDate = marketingFromDate(period)
  const until = new Date().toISOString().slice(0, 10)

  const cache: Cache | undefined = (globalThis as any).caches?.default
  const cacheKey = new Request(`https://cache.vendepro.internal/marketing-campaigns?org=${orgId}&period=${period}&until=${until}`)
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => undefined)
    // Copia: los headers de una Response cacheada son inmutables y el
    // middleware CORS necesita poder setearlos.
    if (hit) return new Response(hit.body, hit)
  }

  const useCase = new GetCampaignInsightsUseCase(
    new D1MetaIntegrationRepository(db),
    new MetaAdsInsightsHttp(),
    (cipher) => decrypt(cipher, c.env.JWT_SECRET),
  )
  const result = await useCase.execute({ orgId, since: fromDate, until })

  // Atribución CRM: leads del período agrupados por campaña y stage.
  const crmByCampaign: Record<string, { leads: number; calificados: number; captados: number }> = {}
  if (result.status === 'ok' && result.campaigns.length > 0) {
    const rows = await db.prepare(`
      SELECT lower(source_detail) as campaign_key, stage, COUNT(*) as count
      FROM leads
      WHERE org_id = ? AND created_at >= ? AND source_detail IS NOT NULL AND source_detail != ''
      GROUP BY campaign_key, stage
    `).bind(orgId, fromDate).all().catch(() => ({ results: [] }))
    for (const r of (rows.results as any[])) {
      const entry = crmByCampaign[r.campaign_key] ?? (crmByCampaign[r.campaign_key] = { leads: 0, calificados: 0, captados: 0 })
      entry.leads += r.count
      if (QUALIFIED_STAGES.has(r.stage)) entry.calificados += r.count
      if (r.stage === 'captado') entry.captados += r.count
    }
  }

  const campaigns = result.campaigns.map(cp => {
    const crm = crmByCampaign[cp.campaign_name.toLowerCase()] ?? { leads: 0, calificados: 0, captados: 0 }
    const leadsForCpl = crm.leads > 0 ? crm.leads : cp.leads
    return {
      ...cp,
      crm_leads: crm.leads,
      crm_calificados: crm.calificados,
      crm_captados: crm.captados,
      cpl: leadsForCpl > 0 ? cp.spend / leadsForCpl : null,
    }
  }).sort((a, b) => b.spend - a.spend)

  const response = Response.json({
    status: result.status,
    error: result.error ?? null,
    period,
    from: fromDate,
    to: until,
    campaigns,
  }, {
    headers: { 'Cache-Control': `max-age=${CAMPAIGNS_CACHE_SECONDS}` },
  })

  // Solo cachear respuestas exitosas — un error transitorio de Meta no
  // debe quedar pegado 15 minutos.
  if (cache && result.status === 'ok') {
    await cache.put(cacheKey, response.clone()).catch(() => {})
  }
  return response
})

export default app
