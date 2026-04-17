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
})
