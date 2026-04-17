import { describe, it, expect, vi } from 'vitest'
import { GetListingsPerformanceUseCase } from '../../../src/application/use-cases/analytics/get-listings-performance'

const makeRepo = () => ({
  getPerformanceTotals: vi.fn(),
  getNeighborhoodPerformance: vi.fn(),
  getTimelinePerformance: vi.fn(),
  listReportsWithMetrics: vi.fn(),
})

describe('GetListingsPerformanceUseCase', () => {
  it('computes per-report averages + semáforo KPIs from totals', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 4,
      total_impressions: 2000,
      total_portal_visits: 600,  // 30 días → 20 vis/día → yellow
      total_in_person_visits: 9, // 30 días → 2.1 vis/semana
      total_offers: 3,
      total_days: 30,
    })
    repo.getNeighborhoodPerformance.mockResolvedValue([])
    repo.getTimelinePerformance.mockResolvedValue([])

    const useCase = new GetListingsPerformanceUseCase(repo)
    const res = await useCase.execute({
      orgId: 'org_mg',
      period: 'month',
      source: null,
      now: new Date('2026-04-17T00:00:00Z'),
    })

    expect(res.kpis.reports_published).toBe(4)
    expect(res.kpis.avg_impressions_per_report).toBe(500)
    expect(res.kpis.avg_views_per_day).toBe(20)
    expect(res.kpis.avg_in_person_visits_per_week).toBe(2.1)
    expect(res.kpis.overall_health_status).toBe('yellow')
    expect(res.benchmarks.source).toMatch(/Marcela Genta/)
  })

  it('returns zeros + red status when no reports published', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 0,
      total_impressions: 0,
      total_portal_visits: 0,
      total_in_person_visits: 0,
      total_offers: 0,
      total_days: 0,
    })
    repo.getNeighborhoodPerformance.mockResolvedValue([])
    repo.getTimelinePerformance.mockResolvedValue([])

    const useCase = new GetListingsPerformanceUseCase(repo)
    const res = await useCase.execute({ orgId: 'org_mg', period: 'week', source: null })

    expect(res.kpis.reports_published).toBe(0)
    expect(res.kpis.avg_views_per_day).toBe(0)
    expect(res.kpis.overall_health_status).toBe('red')
  })

  it('computes health_status per neighborhood', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 1, total_impressions: 100, total_portal_visits: 10,
      total_in_person_visits: 1, total_offers: 0, total_days: 30,
    })
    repo.getNeighborhoodPerformance.mockResolvedValue([
      {
        neighborhood: 'Villa Urquiza',
        reports_count: 2,
        avg_impressions: 500,
        avg_portal_visits: 300,
        avg_in_person_visits: 4,
        avg_offers: 0.5,
        total_offers: 1,
        total_portal_visits: 600,
        total_in_person_visits: 8,
        total_days: 20, // 600/20 = 30 vis/día → green
      },
    ])
    repo.getTimelinePerformance.mockResolvedValue([])

    const useCase = new GetListingsPerformanceUseCase(repo)
    const res = await useCase.execute({ orgId: 'org_mg', period: 'month', source: null })

    expect(res.by_neighborhood[0]?.avg_views_per_day).toBe(30)
    expect(res.by_neighborhood[0]?.health_status).toBe('green')
  })

  it('maps timeline month_key to Spanish label', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 1, total_impressions: 100, total_portal_visits: 10,
      total_in_person_visits: 1, total_offers: 0, total_days: 30,
    })
    repo.getNeighborhoodPerformance.mockResolvedValue([])
    repo.getTimelinePerformance.mockResolvedValue([
      { month_key: '2026-03', impressions: 100, portal_visits: 10, in_person_visits: 1, offers: 0 },
    ])

    const useCase = new GetListingsPerformanceUseCase(repo)
    const res = await useCase.execute({ orgId: 'org_mg', period: 'month', source: null })

    expect(res.timeline[0]?.period_label).toBe('Mar 2026')
    expect(res.timeline[0]?.period_start).toBe('2026-03-01')
  })

  it('forwards source filter to repo', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 0, total_impressions: 0, total_portal_visits: 0,
      total_in_person_visits: 0, total_offers: 0, total_days: 0,
    })
    repo.getNeighborhoodPerformance.mockResolvedValue([])
    repo.getTimelinePerformance.mockResolvedValue([])

    const useCase = new GetListingsPerformanceUseCase(repo)
    await useCase.execute({ orgId: 'org_mg', period: 'month', source: 'zonaprop' })

    expect(repo.getPerformanceTotals).toHaveBeenCalledWith('org_mg', expect.any(String), expect.any(String), 'zonaprop', null)
  })

  it('forwards listingFilters to all repo queries', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 0, total_impressions: 0, total_portal_visits: 0,
      total_in_person_visits: 0, total_offers: 0, total_days: 0,
    })
    repo.getNeighborhoodPerformance.mockResolvedValue([])
    repo.getTimelinePerformance.mockResolvedValue([])

    const useCase = new GetListingsPerformanceUseCase(repo)
    const filters = { property_type: 'departamento', price_min: 50000, price_max: 200000 }
    await useCase.execute({ orgId: 'org_mg', period: 'month', source: null, listingFilters: filters })

    expect(repo.getPerformanceTotals).toHaveBeenCalledWith('org_mg', expect.any(String), expect.any(String), null, filters)
    expect(repo.getNeighborhoodPerformance).toHaveBeenCalledWith('org_mg', expect.any(String), expect.any(String), null, filters)
    expect(repo.getTimelinePerformance).toHaveBeenCalledWith('org_mg', expect.any(String), expect.any(String), null, filters)
  })
})
