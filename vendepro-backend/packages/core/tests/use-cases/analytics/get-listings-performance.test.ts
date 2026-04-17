import { describe, it, expect, vi } from 'vitest'
import { GetListingsPerformanceUseCase } from '../../../src/application/use-cases/analytics/get-listings-performance'

const makeRepo = () => ({
  getPerformanceTotals: vi.fn(),
  getNeighborhoodPerformance: vi.fn(),
  getTimelinePerformance: vi.fn(),
  listReportsWithMetrics: vi.fn(),
})

describe('GetListingsPerformanceUseCase', () => {
  it('computes per-report averages from totals', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 4,
      total_impressions: 2000,
      total_portal_visits: 200,
      total_in_person_visits: 16,
      total_offers: 3,
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
    expect(res.kpis.avg_portal_visits_per_report).toBe(50)
    expect(res.kpis.avg_in_person_visits_per_report).toBe(4)
    expect(res.kpis.avg_offers_per_report).toBe(0.75)
    expect(res.period).toBe('month')
    expect(res.end).toBe('2026-04-17')
    expect(res.start).toBe('2026-03-17')
  })

  it('returns zeros when no reports published', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 0,
      total_impressions: 0,
      total_portal_visits: 0,
      total_in_person_visits: 0,
      total_offers: 0,
    })
    repo.getNeighborhoodPerformance.mockResolvedValue([])
    repo.getTimelinePerformance.mockResolvedValue([])

    const useCase = new GetListingsPerformanceUseCase(repo)
    const res = await useCase.execute({ orgId: 'org_mg', period: 'week', source: null })

    expect(res.kpis.reports_published).toBe(0)
    expect(res.kpis.avg_impressions_per_report).toBe(0)
    expect(res.kpis.avg_offers_per_report).toBe(0)
    expect(res.by_neighborhood).toEqual([])
    expect(res.timeline).toEqual([])
  })

  it('maps timeline month_key to Spanish label', async () => {
    const repo = makeRepo()
    repo.getPerformanceTotals.mockResolvedValue({
      reports_published: 1, total_impressions: 100, total_portal_visits: 10,
      total_in_person_visits: 1, total_offers: 0,
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
      total_in_person_visits: 0, total_offers: 0,
    })
    repo.getNeighborhoodPerformance.mockResolvedValue([])
    repo.getTimelinePerformance.mockResolvedValue([])

    const useCase = new GetListingsPerformanceUseCase(repo)
    await useCase.execute({ orgId: 'org_mg', period: 'month', source: 'zonaprop' })

    expect(repo.getPerformanceTotals).toHaveBeenCalledWith('org_mg', expect.any(String), expect.any(String), 'zonaprop')
  })
})
