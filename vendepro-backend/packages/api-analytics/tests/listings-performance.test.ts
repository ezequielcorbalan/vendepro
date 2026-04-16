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
})
