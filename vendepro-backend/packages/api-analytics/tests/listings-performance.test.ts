import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockKpis = {
  reports_published: 10,
  total_impressions: 5000,
  total_portal_visits: 400,
  total_in_person_visits: 20,
  total_offers: 5,
  avg_impressions_per_report: 500,
  avg_portal_visits_per_report: 40,
  avg_in_person_visits_per_report: 2,
  avg_offers_per_report: 0.5,
  avg_views_per_day: 16.7,
  avg_in_person_visits_per_week: 2.3,
  overall_health_status: 'yellow' as const,
}

const mockBenchmarks = {
  caba: { min_views_per_day: 14, min_in_person_visits_per_week: 1.5 },
  gba:  { min_views_per_day: 8,  min_in_person_visits_per_week: 1.0 },
  color_thresholds: {
    red:          { max_views_per_day: 9 },
    orange:       { max_views_per_day: 13 },
    yellow:       { max_views_per_day: 22 },
    light_green:  { max_views_per_day: 27 },
    green:        { min_views_per_day: 28 },
  },
  source: 'Marcela Genta Operaciones Inmobiliarias — Semáforo de visualizaciones',
}

vi.mock('../src/reports-queries', () => ({
  periodStartDate: vi.fn().mockReturnValue('2026-03-16'),
  getPerformanceKpis: vi.fn().mockResolvedValue(mockKpis),
  getNeighborhoodPerformance: vi.fn().mockResolvedValue([
    {
      neighborhood: 'Villa Urquiza',
      reports_count: 4,
      avg_impressions: 600,
      avg_portal_visits: 50,
      avg_in_person_visits: 3,
      avg_offers: 0.5,
      total_offers: 2,
      avg_views_per_day: 20,
      avg_in_person_visits_per_week: 1.5,
      health_status: 'yellow',
    },
  ]),
  getTimelinePerformance: vi.fn().mockResolvedValue([
    {
      period_label: 'Marzo 2026',
      period_start: '2026-03-01',
      impressions: 2500,
      portal_visits: 200,
      in_person_visits: 10,
      offers: 3,
    },
  ]),
  listReportsWithMetrics: vi.fn().mockResolvedValue({ total: 0, results: [] }),
  computeHealthStatus: vi.fn(),
  daysBetween: vi.fn(),
  BENCHMARKS: mockBenchmarks,
  computeDeltaHealthStatus: vi.fn(),
  getComparisonByNeighborhood: vi.fn().mockResolvedValue([
    {
      neighborhood: 'Villa Urquiza',
      sold: {
        property_count: 3,
        reports_count: 5,
        avg_views_per_day: 45,
        avg_portal_visits_per_report: 500,
        avg_in_person_visits_per_week: 2.5,
        avg_inquiries_per_report: 12,
      },
      active: {
        property_count: 2,
        reports_count: 3,
        avg_views_per_day: 22,
        avg_portal_visits_per_report: 300,
        avg_in_person_visits_per_week: 1.2,
        avg_inquiries_per_report: 6,
      },
      delta_views_per_day_pct: -51.1,
      delta_health_status: 'red',
    },
  ]),
  getActiveListingsWithBenchmark: vi.fn().mockResolvedValue([
    {
      property_id: 'prop-no-reports',
      address: 'Nueva sin reportes',
      neighborhood: 'Villa Urquiza',
      reports_count: 0,
      avg_views_per_day: 0,
      avg_in_person_visits_per_week: 0,
      latest_report_published_at: null,
      latest_report_period_label: null,
      neighborhood_sold_avg_views_per_day: 45,
      delta_vs_neighborhood_pct: null,
      delta_health_status: 'light_green',
    },
    {
      property_id: 'prop-1',
      address: 'Bauness 2906',
      neighborhood: 'Villa Urquiza',
      reports_count: 1,
      avg_views_per_day: 34.1,
      avg_in_person_visits_per_week: 0.9,
      latest_report_published_at: '2026-04-01T10:00:00Z',
      latest_report_period_label: 'Marzo 2026',
      neighborhood_sold_avg_views_per_day: 45,
      delta_vs_neighborhood_pct: -24.2,
      delta_health_status: 'yellow',
    },
    {
      property_id: 'prop-2',
      address: 'Triunvirato 4180',
      neighborhood: 'Villa Urquiza',
      reports_count: 1,
      avg_views_per_day: 11.5,
      avg_in_person_visits_per_week: 0.3,
      latest_report_published_at: '2026-03-05T11:30:00Z',
      latest_report_period_label: 'Febrero 2026',
      neighborhood_sold_avg_views_per_day: 45,
      delta_vs_neighborhood_pct: -74.4,
      delta_health_status: 'red',
    },
    {
      property_id: 'prop-3',
      address: 'Cabildo 2500',
      neighborhood: 'Belgrano',
      reports_count: 1,
      avg_views_per_day: 15.6,
      avg_in_person_visits_per_week: 0.5,
      latest_report_published_at: '2026-03-02T09:00:00Z',
      latest_report_period_label: 'Febrero 2026',
      neighborhood_sold_avg_views_per_day: null,
      delta_vs_neighborhood_pct: null,
      delta_health_status: 'light_green',
    },
  ]),
}))

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
  }
})

describe('GET /listings-performance', () => {
  beforeEach(() => { vi.clearAllMocks() })

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
    // Primera fila: propiedad sin reportes (caso "sin reportes aún")
    expect(body.active_listings[0].reports_count).toBe(0)
    expect(body.active_listings[0].latest_report_published_at).toBeNull()
    // Segunda fila: Bauness con reportes y benchmark
    expect(body.active_listings[1].address).toBe('Bauness 2906')
    expect(body.active_listings[1].delta_vs_neighborhood_pct).toBe(-24.2)
    expect(body.active_listings[1].delta_health_status).toBe('yellow')
    expect(body.active_listings[1].latest_report_period_label).toBe('Marzo 2026')
    // Última fila: propiedad sin benchmark (barrio sin vendidas)
    expect(body.active_listings[3].delta_vs_neighborhood_pct).toBeNull()
    expect(body.active_listings[3].delta_health_status).toBe('light_green')
  })
})
