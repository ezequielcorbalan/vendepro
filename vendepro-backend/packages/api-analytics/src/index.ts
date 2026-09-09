import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1LeadRepository, D1PropertyRepository, D1ReservationRepository, D1CalendarRepository, D1AnalyticsReportRepository, D1ActivityRepository, D1AppraisalRepository, D1ContactRepository, D1ObjectiveRepository, D1UserRepository, D1MetaIntegrationRepository, D1PortalSpendRepository, D1PortalLeadCountRepository, D1CampaignGoalRepository, D1PropertyIncomeRepository, DolarApiFxRate, JwtAuthService, MetaAdsInsightsHttp, decrypt } from '@vendepro/infrastructure'
import {
  GetCampaignInsightsUseCase,
  GetPortalCostsUseCase,
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
  parseMarketingPeriod,
  marketingPeriodRanges,
  periodDelta,
  parseFunnelPipeline,
  computeFunnelForPipeline,
  computeConversionRateForPipeline,
  FUNNEL_GOAL_STAGE,
  splitCampaignsByGoal,
  goalForPipeline,
  aggregateIncome,
  computeRoi,
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
// El panel tiene dos secciones — Captación (pipeline vendedor) y Demanda
// (comprador) — y TODAS las series se filtran por el mismo pipeline. Antes el
// embudo era vendedor y "leads por fuente" traía todos: el total de arriba no
// era la suma de las barras de abajo, y los leads de portal (compradores
// consultando una publicación) aparecían como la principal "fuente de
// marketing" de una pantalla de captación.
//
// Los tres períodos son de calendario hasta hoy y el anterior es del mismo
// largo en días — ver `marketing-period.ts` en core.

/** Etapas que ya pasaron el filtro de calificación, por pipeline. */
const QUALIFIED_STAGES: Record<string, Set<string>> = {
  vendedor: new Set(['calificado', 'en_tasacion', 'presentada', 'seguimiento', 'captado']),
  comprador: new Set(['calificado', 'visita_agendada', 'visito', 'oferta', 'cerrado']),
}

app.get('/marketing', async (c) => {
  const orgId = c.get('orgId')
  // La config de pixel/GA4 es por agente desde la migración 040: se lee la del
  // usuario que mira, igual que el ad account de /marketing/campaigns. Antes se
  // consultaba por org_id sobre una tabla cuya PK es agent_id, así que el badge
  // podía mostrar la config de cualquier otro agente.
  const agentId = c.get('userId')
  const db = c.env.DB
  const period = parseMarketingPeriod(c.req.query('period'))
  const pipeline = parseFunnelPipeline(c.req.query('pipeline'))
  const { current, previous, elapsedDays } = marketingPeriodRanges(period)

  // Marketing por usuario: cada agente cruza SU presupuesto contra SUS leads.
  // Admin y owner ven la inmobiliaria entera — mismo criterio que el log de
  // eventos de marketing en api-crm.
  const role = c.get('userRole')
  const ownerUserId = role === 'admin' || role === 'owner' ? undefined : agentId
  const ownerFilter = ownerUserId ? ' AND assigned_to = ?' : ''
  const ownerArg = ownerUserId ? [ownerUserId] : []

  const scoped = `org_id = ? AND COALESCE(pipeline, 'vendedor') = ? AND created_at >= ? AND created_at < ?${ownerFilter}`
  const args = [orgId, pipeline, current.from, current.to, ...ownerArg]

  const [leadsBySource, leadsByDay, stageBreakdown, prevStageBreakdown, metaEvents, metaIntegration] = await Promise.all([
    db.prepare(`SELECT source, COUNT(*) as count FROM leads WHERE ${scoped} GROUP BY source ORDER BY count DESC`).bind(...args).all(),
    db.prepare(`SELECT substr(created_at, 1, 10) as day, COUNT(*) as count FROM leads WHERE ${scoped} GROUP BY day ORDER BY day ASC`).bind(...args).all(),
    db.prepare(`SELECT stage, COUNT(*) as count FROM leads WHERE ${scoped} GROUP BY stage`).bind(...args).all(),
    db.prepare(`SELECT stage, COUNT(*) as count FROM leads WHERE ${scoped} GROUP BY stage`).bind(orgId, pipeline, previous.from, previous.to, ...ownerArg).all(),
    // Solo eventos de Meta CAPI (no GA4, que se loguea aparte con sus propios
    // nombres) y solo del período seleccionado. Es de toda la org a propósito:
    // el envío de conversiones es un hecho de la inmobiliaria, no del usuario.
    db.prepare(`SELECT event_name, status, COUNT(*) as count FROM meta_event_log WHERE org_id = ? AND provider = 'meta' AND created_at >= ? AND created_at < ? GROUP BY event_name, status`).bind(orgId, current.from, current.to).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT enabled, pixel_id, ga4_enabled, ga4_measurement_id FROM meta_integration WHERE agent_id = ?`).bind(agentId).first().catch(() => null),
  ])

  const tally = (rows: any[]) => {
    const sb: Record<string, number> = {}
    for (const r of rows) sb[r.stage] = r.count
    return { sb, total: Object.values(sb).reduce((a, b) => a + b, 0) }
  }

  const cur = tally(stageBreakdown.results as any[])
  const prev = tally(prevStageBreakdown.results as any[])
  const goalStage = FUNNEL_GOAL_STAGE[pipeline]

  const totals = {
    leads: cur.total,
    goal: cur.sb[goalStage] ?? 0,
    conversionRate: computeConversionRateForPipeline(pipeline, cur.sb, cur.total),
  }
  const previousTotals = {
    leads: prev.total,
    goal: prev.sb[goalStage] ?? 0,
    conversionRate: computeConversionRateForPipeline(pipeline, prev.sb, prev.total),
  }

  const eventMap: Record<string, { sent: number; failed: number }> = {}
  for (const r of (metaEvents.results as any[])) {
    if (!eventMap[r.event_name]) eventMap[r.event_name] = { sent: 0, failed: 0 }
    if (r.status === 'sent') eventMap[r.event_name].sent += r.count
    else if (r.status === 'failed') eventMap[r.event_name].failed += r.count
  }

  // Costo por portal — sólo tiene sentido en Demanda: el gasto de portales es
  // inventario para compradores, no captación. El gasto mensual se prorratea
  // por los días del rango antes de cruzarlo con los leads.
  const portalCosts = pipeline === 'comprador'
    ? await new GetPortalCostsUseCase(
        new D1PortalSpendRepository(db),
        new D1PortalLeadCountRepository(db),
        new D1PropertyIncomeRepository(db),
      ).execute({ orgId, from: current.from, to: current.to, ownerUserId }).catch(() => null)
    : null

  return c.json({
    period,
    pipeline,
    portalCosts,
    goal_stage: goalStage,
    range: { ...current, previous_from: previous.from, previous_to: previous.to, elapsed_days: elapsedDays },
    totals,
    previous: previousTotals,
    deltas: {
      leads: periodDelta(totals.leads, previousTotals.leads),
      goal: periodDelta(totals.goal, previousTotals.goal),
      // Una tasa se compara en puntos porcentuales, no en variación porcentual:
      // "la conversión subió 50%" cuando pasa de 2% a 3% no le dice nada a nadie.
      conversionRatePoints: Math.round((totals.conversionRate - previousTotals.conversionRate) * 10) / 10,
    },
    funnel: computeFunnelForPipeline(pipeline, cur.sb, cur.total),
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
//
// El CPL viaja con su base declarada: `cpl_crm` (gasto ÷ leads del CRM) y
// `cpl_meta` (gasto ÷ leads que reporta Meta) son dos números distintos y no se
// pueden mezclar en una sola columna sin decir cuál es cuál — que es lo que
// hacía antes, cayendo a Meta en silencio cuando el CRM no tenía nada atribuido.

const CAMPAIGNS_CACHE_SECONDS = 900 // Meta Insights ratelimitea agresivo

app.get('/marketing/campaigns', async (c) => {
  const orgId = c.get('orgId')
  // El Ad Account es por-agente: las campañas se leen de la config del usuario.
  const agentId = c.get('userId')
  const db = c.env.DB
  const period = parseMarketingPeriod(c.req.query('period'))
  const pipeline = parseFunnelPipeline(c.req.query('pipeline'))
  const { current } = marketingPeriodRanges(period)
  // La cuenta publicitaria ya es del usuario; los leads y los honorarios que se
  // cruzan contra ella tienen que serlo también. Admin y owner ven la org entera.
  const campaignRole = c.get('userRole')
  const campaignOwner = campaignRole === 'admin' || campaignRole === 'owner' ? undefined : agentId
  const campaignOwnerFilter = campaignOwner ? ' AND assigned_to = ?' : ''
  const campaignOwnerArg = campaignOwner ? [campaignOwner] : []
  const since = current.from
  // `to` es exclusivo; el time_range de Meta es inclusivo en los dos extremos.
  const until = new Date(Date.parse(current.to) - 86_400_000).toISOString().slice(0, 10)

  const cache: Cache | undefined = (globalThis as any).caches?.default
  const cacheKey = new Request(`https://cache.vendepro.internal/marketing-campaigns?agent=${agentId}&period=${period}&pipeline=${pipeline}&until=${until}`)
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
  const result = await useCase.execute({ agentId, since, until })

  // Atribución CRM: leads del período agrupados por campaña y stage.
  const qualified = QUALIFIED_STAGES[pipeline] ?? QUALIFIED_STAGES.vendedor!
  const goalStage = FUNNEL_GOAL_STAGE[pipeline]
  const crmByCampaign: Record<string, { leads: number; calificados: number; ganados: number }> = {}
  if (result.status === 'ok' && result.campaigns.length > 0) {
    const rows = await db.prepare(`
      SELECT lower(source_detail) as campaign_key, stage, COUNT(*) as count
      FROM leads
      WHERE org_id = ? AND created_at >= ? AND created_at < ?
        AND source_detail IS NOT NULL AND source_detail != ''
        AND COALESCE(pipeline, 'vendedor') = ?${campaignOwnerFilter}
      GROUP BY campaign_key, stage
    `).bind(orgId, current.from, current.to, pipeline, ...campaignOwnerArg).all().catch(() => ({ results: [] }))
    for (const r of (rows.results as any[])) {
      const entry = crmByCampaign[r.campaign_key] ?? (crmByCampaign[r.campaign_key] = { leads: 0, calificados: 0, ganados: 0 })
      entry.leads += r.count
      if (qualified.has(r.stage)) entry.calificados += r.count
      if (r.stage === goalStage) entry.ganados += r.count
    }
  }

  // Honorarios de las operaciones que cerró cada campaña. Del lado de captación
  // la atribución sale del lead que originó la propiedad; del lado de demanda,
  // del comprador que la compró.
  const incomeRows = result.status === 'ok'
    ? await (pipeline === 'vendedor'
        ? new D1PropertyIncomeRepository(db).findIncomeByCaptureCampaign(orgId, current.from, current.to, campaignOwner)
        : new D1PropertyIncomeRepository(db).findIncomeByBuyerSource(orgId, current.from, current.to, campaignOwner)
      ).catch(() => [])
    : []
  const income = aggregateIncome(incomeRows)

  // El gasto viene en la moneda de la cuenta publicitaria y los honorarios en
  // dólares: sin convertir no se pueden dividir. Si la cuenta no es en USD se
  // busca el dólar del día; si no se consigue, el ROI queda en null con motivo
  // en vez de mezclar pesos con dólares.
  const accountCurrency = result.campaigns[0]?.account_currency ?? null
  let spendToUsd: number | null = accountCurrency === 'USD' || accountCurrency === null ? 1 : null
  if (spendToUsd === null && accountCurrency) {
    const fx = await new DolarApiFxRate().usdRate(accountCurrency).catch(() => null)
    spendToUsd = fx ? fx.rate : null
  }

  const enriched = result.campaigns.map(cp => {
    const crm = crmByCampaign[cp.campaign_name.toLowerCase()] ?? { leads: 0, calificados: 0, ganados: 0 }
    const attributed = income.byAttribution.get(cp.campaign_name.toLowerCase()) ?? null
    const incomeUsd = attributed?.income_usd ?? null
    const spendUsd = spendToUsd !== null && spendToUsd > 0 ? cp.spend / spendToUsd : null
    return {
      ...cp,
      crm_leads: crm.leads,
      crm_calificados: crm.calificados,
      crm_ganados: crm.ganados,
      cpl_crm: crm.leads > 0 ? cp.spend / crm.leads : null,
      cpl_meta: cp.leads > 0 ? cp.spend / cp.leads : null,
      income_usd: incomeUsd,
      operations: attributed?.operations ?? 0,
      roi: computeRoi(incomeUsd, spendUsd),
    }
  }).sort((a, b) => b.spend - a.spend)

  // Meta no sabe a qué objetivo comercial apunta cada campaña (su `objective`
  // dice cómo optimiza, no para qué la usa la inmobiliaria), así que la etiqueta
  // la pone el usuario. Las que todavía no tienen etiqueta NO se reparten en las
  // dos secciones: contar el mismo gasto dos veces dejaría el costo por
  // captación a la mitad del real. Quedan en una bandeja aparte.
  const goals = await new D1CampaignGoalRepository(db).findByOrg(orgId, 'meta').catch(() => new Map())
  const split = splitCampaignsByGoal(enriched, goals, goalForPipeline(pipeline))
  const withGoal = <T extends { campaign_id: string }>(rows: T[]) =>
    rows.map(r => ({ ...r, goal: goals.get(r.campaign_id) ?? null }))

  const response = Response.json({
    status: result.status,
    error: result.error ?? null,
    period,
    pipeline,
    goal: goalForPipeline(pipeline),
    goal_stage: goalStage,
    from: since,
    to: until,
    campaigns: withGoal(split.matching),
    unclassified: withGoal(split.unclassified),
    unclassified_spend: split.unclassified_spend,
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
