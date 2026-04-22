import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Raw totals returned by the repo ──────────────────────────
// Design values so the use cases compute the expected final shapes.

const performanceTotals = {
  reports_published: 10,
  total_impressions: 5000,
  total_portal_visits: 500,     // 500 / 30 days → 16.67 views/day → yellow
  total_in_person_visits: 10,   // (10/30) * 7 → 2.33 / week
  total_offers: 5,
  total_days: 30,
}

const neighborhoodRows = [
  {
    neighborhood: 'Villa Urquiza',
    reports_count: 4,
    avg_impressions: 600,
    avg_portal_visits: 50,
    avg_in_person_visits: 3,
    avg_offers: 0.5,
    total_offers: 2,
    total_portal_visits: 600,   // 600/30 = 20 → yellow
    total_in_person_visits: 6,
    total_days: 30,
  },
]

const timelineRows = [
  { month_key: '2026-03', impressions: 2500, portal_visits: 200, in_person_visits: 10, offers: 3 },
]

const soldTotals = [
  {
    neighborhood: 'Villa Urquiza',
    property_count: 3,
    reports_count: 5,
    total_portal_visits: 1350,   // 1350/30 = 45
    total_in_person_visits: 15,
    total_inquiries: 60,
    total_days: 30,
  },
]

const activeTotals = [
  {
    neighborhood: 'Villa Urquiza',
    property_count: 2,
    reports_count: 3,
    total_portal_visits: 660,    // 660/30 = 22 → delta (22-45)/45 = -51.1%
    total_in_person_visits: 7,
    total_inquiries: 18,
    total_days: 30,
  },
]

const soldBenchmarks = [
  { neighborhood: 'Villa Urquiza', total_portal_visits: 1350, total_days: 30 }, // benchmark 45
]

// Four active listings — order below is shuffled to verify the use case sorts
// (reports=0 first, then most negative delta, then null delta last).
const activeListings = [
  {
    property_id: 'prop-1',
    address: 'Bauness 2906',
    neighborhood: 'Villa Urquiza',
    reports_count: 1,
    total_portal_visits: 1023,   // 1023/30 = 34.1 → delta (34.1-45)/45 = -24.2%
    total_in_person_visits: 4,
    total_days: 30,
    latest_report_published_at: '2026-04-01T10:00:00Z',
    latest_report_period_label: 'Marzo 2026',
  },
  {
    property_id: 'prop-other',
    address: 'Triunvirato 4180',
    neighborhood: 'Villa Urquiza',
    reports_count: 1,
    total_portal_visits: 1200,   // 1200/30 = 40 → delta (40-45)/45 = -11.1%
    total_in_person_visits: 4,
    total_days: 30,
    latest_report_published_at: '2026-03-20T10:00:00Z',
    latest_report_period_label: 'Marzo 2026',
  },
  {
    property_id: 'prop-belgrano',
    address: 'Cabildo 2500',
    neighborhood: 'Belgrano',    // no benchmark → null delta → light_green, goes last
    reports_count: 1,
    total_portal_visits: 468,
    total_in_person_visits: 2,
    total_days: 30,
    latest_report_published_at: '2026-03-02T09:00:00Z',
    latest_report_period_label: 'Febrero 2026',
  },
  {
    property_id: 'prop-no-reports',
    address: 'Nueva sin reportes',
    neighborhood: 'Villa Urquiza',
    reports_count: 0,            // reports=0 → listing sin reportes, goes first
    total_portal_visits: 0,
    total_in_person_visits: 0,
    total_days: 0,
    latest_report_published_at: null,
    latest_report_period_label: null,
  },
]

const repoStub = {
  getPerformanceTotals: vi.fn().mockResolvedValue(performanceTotals),
  getNeighborhoodPerformance: vi.fn().mockResolvedValue(neighborhoodRows),
  getTimelinePerformance: vi.fn().mockResolvedValue(timelineRows),
  getNeighborhoodTotalsByPropertyStatus: vi.fn().mockImplementation((_org: string, status: string) =>
    status === 'sold' ? soldTotals : activeTotals,
  ),
  getSoldBenchmarkByNeighborhood: vi.fn().mockResolvedValue(soldBenchmarks),
  getActiveListingsWithAggregates: vi.fn().mockResolvedValue(activeListings),
  listReportsWithMetrics: vi.fn(),
}

vi.mock('@vendepro/infrastructure', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    corsMiddleware: async (_c: any, next: any) => next(),
    errorHandler: (err: any, c: any) => c.json({ error: err.message }, 500),
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'agent-1')
      c.set('userRole', 'admin')
      c.set('orgId', 'org_mg')
      await next()
    },
    JwtAuthService: vi.fn().mockImplementation(() => ({})),
    D1LeadRepository: vi.fn().mockImplementation(() => ({})),
    D1PropertyRepository: vi.fn().mockImplementation(() => ({})),
    D1ReservationRepository: vi.fn().mockImplementation(() => ({})),
    D1CalendarRepository: vi.fn().mockImplementation(() => ({})),
    D1AnalyticsReportRepository: vi.fn().mockImplementation(() => repoStub),
  }
})

describe('GET /listings-performance', () => {
  beforeEach(() => {
    repoStub.getPerformanceTotals.mockClear()
    repoStub.getNeighborhoodPerformance.mockClear()
    repoStub.getTimelinePerformance.mockClear()
    repoStub.getNeighborhoodTotalsByPropertyStatus.mockClear()
    repoStub.getSoldBenchmarkByNeighborhood.mockClear()
    repoStub.getActiveListingsWithAggregates.mockClear()
  })

  it('returns KPIs, by_neighborhood and timeline with default period (month)', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any

    expect(body.period).toBe('month')
    expect(body.kpis.reports_published).toBe(10)
    expect(body.kpis.total_impressions).toBe(5000)
    expect(body.by_neighborhood).toHaveLength(1)
    expect(body.by_neighborhood[0].neighborhood).toBe('Villa Urquiza')
    expect(body.timeline).toHaveLength(1)
  })

  it('accepts ?period=year query param', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance?period=year', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.period).toBe('year')
  })

  it('falls back to month on invalid period', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance?period=bogus', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.period).toBe('month')
  })

  it('includes benchmarks object with CABA/GBA thresholds and color_thresholds', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.benchmarks).toBeDefined()
    expect(body.benchmarks.caba.min_views_per_day).toBe(14)
    expect(body.benchmarks.gba.min_views_per_day).toBe(8)
    expect(body.benchmarks.color_thresholds.red.max_views_per_day).toBe(9)
    expect(body.benchmarks.color_thresholds.green.min_views_per_day).toBe(28)
    expect(body.benchmarks.source).toContain('Marcela Genta')
  })

  it('exposes overall_health_status and avg_views_per_day from KPIs', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.kpis.overall_health_status).toBe('yellow')
    expect(body.kpis.avg_views_per_day).toBe(16.7)
    expect(body.kpis.avg_in_person_visits_per_week).toBe(2.3)
  })

  it('each neighborhood includes health_status and avg_views_per_day', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.by_neighborhood[0].health_status).toBe('yellow')
    expect(body.by_neighborhood[0].avg_views_per_day).toBe(20)
  })

  it('includes comparison_by_neighborhood with sold and active groups', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.comparison_by_neighborhood).toBeDefined()
    expect(body.comparison_by_neighborhood).toHaveLength(1)
    expect(body.comparison_by_neighborhood[0].neighborhood).toBe('Villa Urquiza')
    expect(body.comparison_by_neighborhood[0].sold.avg_views_per_day).toBe(45)
    expect(body.comparison_by_neighborhood[0].sold.property_count).toBe(3)
    expect(body.comparison_by_neighborhood[0].active.avg_views_per_day).toBe(22)
    expect(body.comparison_by_neighborhood[0].active.property_count).toBe(2)
    expect(body.comparison_by_neighborhood[0].delta_views_per_day_pct).toBe(-51.1)
    expect(body.comparison_by_neighborhood[0].delta_health_status).toBe('red')
  })

  it('includes active_listings with per-property benchmark comparison', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.active_listings).toBeDefined()
    expect(body.active_listings).toHaveLength(4)
    // [0]: propiedad sin reportes (reports_count=0 va primero)
    expect(body.active_listings[0].reports_count).toBe(0)
    expect(body.active_listings[0].latest_report_published_at).toBeNull()
    // [1]: Bauness — peor delta (-24.2) de los que tienen reportes
    expect(body.active_listings[1].address).toBe('Bauness 2906')
    expect(body.active_listings[1].delta_vs_neighborhood_pct).toBe(-24.2)
    expect(body.active_listings[1].delta_health_status).toBe('yellow')
    expect(body.active_listings[1].latest_report_period_label).toBe('Marzo 2026')
    // [3]: propiedad sin benchmark (barrio Belgrano, sin vendidas) → delta null
    expect(body.active_listings[3].delta_vs_neighborhood_pct).toBeNull()
    expect(body.active_listings[3].delta_health_status).toBe('light_green')
  })
})
