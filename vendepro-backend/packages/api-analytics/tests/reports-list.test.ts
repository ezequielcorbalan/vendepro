import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/reports-queries', () => ({
  periodStartDate: vi.fn(),
  getPerformanceKpis: vi.fn(),
  getNeighborhoodPerformance: vi.fn(),
  getTimelinePerformance: vi.fn(),
  listReportsWithMetrics: vi.fn().mockResolvedValue({
    total: 2,
    results: [
      {
        id: 'r1',
        property_id: 'p1',
        property_address: 'Pampa 1234',
        property_neighborhood: 'Villa Urquiza',
        period_label: 'Marzo 2026',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        status: 'published',
        published_at: '2026-04-01T10:00:00Z',
        impressions: 500,
        portal_visits: 40,
        in_person_visits: 2,
        offers: 1,
        days_in_period: 30,
        views_per_day: 16.7,
        in_person_visits_per_week: 0.5,
        health_status: 'yellow',
      },
      {
        id: 'r2',
        property_id: 'p2',
        property_address: 'Belgrano 5678',
        property_neighborhood: 'Belgrano',
        period_label: 'Marzo 2026',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        status: 'draft',
        published_at: null,
        impressions: 0,
        portal_visits: 0,
        in_person_visits: 0,
        offers: 0,
        days_in_period: 30,
        views_per_day: 0,
        in_person_visits_per_week: 0,
        health_status: 'red',
      },
    ],
  }),
  computeHealthStatus: vi.fn(),
  daysBetween: vi.fn(),
  BENCHMARKS: {
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
  },
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

describe('GET /reports', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns paginated list with total', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/reports', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any

    expect(body.page).toBe(1)
    expect(body.page_size).toBe(20)
    expect(body.total).toBe(2)
    expect(body.results).toHaveLength(2)
    expect(body.results[0].id).toBe('r1')
    expect(body.results[0].property_address).toBe('Pampa 1234')
  })

  it('passes pagination and filters to the query helper', async () => {
    const { listReportsWithMetrics } = await import('../src/reports-queries')
    const { default: app } = await import('../src/index')

    await app.request(
      '/reports?page=2&page_size=5&neighborhood=Villa%20Urquiza&status=published',
      { method: 'GET' },
      { DB: {}, JWT_SECRET: 'secret' },
    )

    expect(listReportsWithMetrics).toHaveBeenCalledWith(
      expect.anything(),
      'org_mg',
      expect.objectContaining({
        page: 2,
        page_size: 5,
        neighborhood: 'Villa Urquiza',
        status: 'published',
      }),
    )
  })

  it('each result includes views_per_day and health_status', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/reports', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.results[0].views_per_day).toBe(16.7)
    expect(body.results[0].health_status).toBe('yellow')
    expect(body.results[1].health_status).toBe('red')
    expect(body.results[0].days_in_period).toBe(30)
    expect(body.results[0].in_person_visits_per_week).toBe(0.5)
  })
})
