import { describe, it, expect, vi } from 'vitest'
import { ListReportsWithMetricsUseCase } from '../../../src/application/use-cases/analytics/list-reports-with-metrics'

describe('ListReportsWithMetricsUseCase', () => {
  it('delegates to repo and returns total + results', async () => {
    const repo = {
      getPerformanceTotals: vi.fn(),
      getNeighborhoodPerformance: vi.fn(),
      getTimelinePerformance: vi.fn(),
      listReportsWithMetrics: vi.fn().mockResolvedValue({
        total: 3,
        results: [
          {
            id: 'r1', property_id: 'p1', property_address: 'Av Corrientes 123',
            property_neighborhood: 'Centro', period_label: 'Abril 2026',
            period_start: '2026-04-01', period_end: '2026-04-30',
            status: 'published', published_at: '2026-04-10',
            impressions: 100, portal_visits: 20, in_person_visits: 2, offers: 0,
          },
        ],
      }),
    }

    const useCase = new ListReportsWithMetricsUseCase(repo)
    const result = await useCase.execute('org_mg', {
      page: 1,
      page_size: 10,
      neighborhood: null,
      status: null,
      property_id: null,
      from: null,
      to: null,
    })

    expect(result.total).toBe(3)
    expect(result.results).toHaveLength(1)
    expect(repo.listReportsWithMetrics).toHaveBeenCalledWith('org_mg', expect.objectContaining({
      page: 1, page_size: 10,
    }))
  })
})
