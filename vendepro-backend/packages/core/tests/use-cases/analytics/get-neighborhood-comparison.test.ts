import { describe, it, expect, vi } from 'vitest'
import { GetNeighborhoodComparisonUseCase } from '../../../src/application/use-cases/analytics/get-neighborhood-comparison'

const makeRepo = () => ({
  getPerformanceTotals: vi.fn(),
  getNeighborhoodPerformance: vi.fn(),
  getTimelinePerformance: vi.fn(),
  listReportsWithMetrics: vi.fn(),
  getNeighborhoodTotalsByPropertyStatus: vi.fn(),
  getSoldBenchmarkByNeighborhood: vi.fn(),
  getActiveListingsWithAggregates: vi.fn(),
})

describe('GetNeighborhoodComparisonUseCase', () => {
  it('computes delta% between active and sold per neighborhood', async () => {
    const repo = makeRepo()
    repo.getNeighborhoodTotalsByPropertyStatus
      .mockResolvedValueOnce([ // sold
        {
          neighborhood: 'Villa Urquiza',
          property_count: 2, reports_count: 4,
          total_portal_visits: 800, total_in_person_visits: 12,
          total_inquiries: 20, total_days: 40, // 800/40 = 20 vis/día
        },
      ])
      .mockResolvedValueOnce([ // active
        {
          neighborhood: 'Villa Urquiza',
          property_count: 3, reports_count: 6,
          total_portal_visits: 900, total_in_person_visits: 9,
          total_inquiries: 15, total_days: 60, // 900/60 = 15 vis/día
        },
      ])

    const useCase = new GetNeighborhoodComparisonUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result).toHaveLength(1)
    const row = result[0]!
    expect(row.neighborhood).toBe('Villa Urquiza')
    expect(row.sold?.avg_views_per_day).toBe(20)
    expect(row.active?.avg_views_per_day).toBe(15)
    expect(row.delta_views_per_day_pct).toBe(-25) // (15-20)/20 = -25%
    expect(row.delta_health_status).toBe('yellow') // between -10 and -30
  })

  it('returns null metrics when reports_count is zero', async () => {
    const repo = makeRepo()
    repo.getNeighborhoodTotalsByPropertyStatus
      .mockResolvedValueOnce([]) // sold
      .mockResolvedValueOnce([{
        neighborhood: 'Belgrano',
        property_count: 1, reports_count: 0,
        total_portal_visits: 0, total_in_person_visits: 0,
        total_inquiries: 0, total_days: 0,
      }])

    const useCase = new GetNeighborhoodComparisonUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result[0]?.sold).toBeNull()
    expect(result[0]?.active).toBeNull()
    expect(result[0]?.delta_views_per_day_pct).toBeNull()
    expect(result[0]?.delta_health_status).toBe('light_green')
  })

  it('sorts by active reports_count descending', async () => {
    const repo = makeRepo()
    repo.getNeighborhoodTotalsByPropertyStatus
      .mockResolvedValueOnce([]) // sold
      .mockResolvedValueOnce([
        {
          neighborhood: 'Villa Urquiza',
          property_count: 1, reports_count: 1,
          total_portal_visits: 100, total_in_person_visits: 1,
          total_inquiries: 2, total_days: 10,
        },
        {
          neighborhood: 'Palermo',
          property_count: 3, reports_count: 5,
          total_portal_visits: 500, total_in_person_visits: 5,
          total_inquiries: 10, total_days: 30,
        },
      ])

    const useCase = new GetNeighborhoodComparisonUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result[0]?.neighborhood).toBe('Palermo')
    expect(result[1]?.neighborhood).toBe('Villa Urquiza')
  })
})
