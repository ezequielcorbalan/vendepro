import { describe, it, expect, vi } from 'vitest'
import { GetActiveListingsWithBenchmarkUseCase } from '../../../src/application/use-cases/analytics/get-active-listings-with-benchmark'

const makeRepo = () => ({
  getPerformanceTotals: vi.fn(),
  getNeighborhoodPerformance: vi.fn(),
  getTimelinePerformance: vi.fn(),
  listReportsWithMetrics: vi.fn(),
  getNeighborhoodTotalsByPropertyStatus: vi.fn(),
  getSoldBenchmarkByNeighborhood: vi.fn(),
  getActiveListingsWithAggregates: vi.fn(),
})

describe('GetActiveListingsWithBenchmarkUseCase', () => {
  it('computes delta vs sold benchmark per listing', async () => {
    const repo = makeRepo()
    repo.getActiveListingsWithAggregates.mockResolvedValue([
      {
        property_id: 'p1', address: 'Corrientes 1', neighborhood: 'Centro',
        reports_count: 2, total_portal_visits: 300, total_in_person_visits: 4,
        total_days: 30,
        latest_report_published_at: '2026-04-10', latest_report_period_label: 'Abril 2026',
      },
    ])
    repo.getSoldBenchmarkByNeighborhood.mockResolvedValue([
      { neighborhood: 'Centro', total_portal_visits: 400, total_days: 20 }, // 20 vis/día
    ])

    const useCase = new GetActiveListingsWithBenchmarkUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result[0]?.avg_views_per_day).toBe(10)  // 300/30
    expect(result[0]?.neighborhood_sold_avg_views_per_day).toBe(20)
    expect(result[0]?.delta_vs_neighborhood_pct).toBe(-50) // (10-20)/20
    expect(result[0]?.delta_health_status).toBe('red') // < -30
  })

  it('treats no-reports listings as urgent (first in sort)', async () => {
    const repo = makeRepo()
    repo.getActiveListingsWithAggregates.mockResolvedValue([
      {
        property_id: 'p1', address: 'Palermo 1', neighborhood: 'Palermo',
        reports_count: 3, total_portal_visits: 600, total_in_person_visits: 5,
        total_days: 30,
        latest_report_published_at: '2026-04-10', latest_report_period_label: 'Abril 2026',
      },
      {
        property_id: 'p2', address: 'Sin reportes 1', neighborhood: 'Belgrano',
        reports_count: 0, total_portal_visits: 0, total_in_person_visits: 0,
        total_days: 0,
        latest_report_published_at: null, latest_report_period_label: null,
      },
    ])
    repo.getSoldBenchmarkByNeighborhood.mockResolvedValue([])

    const useCase = new GetActiveListingsWithBenchmarkUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result[0]?.property_id).toBe('p2') // sin reports primero
    expect(result[1]?.property_id).toBe('p1')
  })

  it('marks delta null and light_green status when no sold benchmark', async () => {
    const repo = makeRepo()
    repo.getActiveListingsWithAggregates.mockResolvedValue([
      {
        property_id: 'p1', address: 'X', neighborhood: 'NuevoBarrio',
        reports_count: 2, total_portal_visits: 100, total_in_person_visits: 1,
        total_days: 10,
        latest_report_published_at: null, latest_report_period_label: null,
      },
    ])
    repo.getSoldBenchmarkByNeighborhood.mockResolvedValue([])

    const useCase = new GetActiveListingsWithBenchmarkUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result[0]?.neighborhood_sold_avg_views_per_day).toBeNull()
    expect(result[0]?.delta_vs_neighborhood_pct).toBeNull()
    expect(result[0]?.delta_health_status).toBe('light_green')
  })
})
