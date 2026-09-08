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

describe('ListReportsWithMetricsUseCase · campos calculados', () => {
  const repoCon = (row: Record<string, unknown>) => ({
    getPerformanceTotals: vi.fn(),
    getNeighborhoodPerformance: vi.fn(),
    getTimelinePerformance: vi.fn(),
    listReportsWithMetrics: vi.fn().mockResolvedValue({ total: 1, results: [row] }),
  }) as any

  const base = {
    id: 'r1', property_id: 'p1', property_address: 'x', property_neighborhood: 'x',
    period_label: 'Abril', status: 'published', published_at: null, public_slug: 'slug-1',
    impressions: 0, offers: 0,
  }

  it('agrega views_per_day, días y semáforo — el refactor hexagonal los había perdido', async () => {
    // 30 días, 600 visitas → 20/día → yellow según el semáforo MG.
    const uc = new ListReportsWithMetricsUseCase(repoCon({
      ...base, period_start: '2026-04-01', period_end: '2026-05-01',
      portal_visits: 600, in_person_visits: 6,
    }))
    const { results } = await uc.execute('org', { page: 1, page_size: 10 })
    expect(results[0].days_in_period).toBe(30)
    expect(results[0].views_per_day).toBe(20)
    expect(results[0].health_status).toBe('yellow')
    expect(results[0].in_person_visits_per_week).toBeCloseTo(1.4)
    // Y no pierde los campos del repo en el camino (public_slug incluido).
    expect(results[0].public_slug).toBe('slug-1')
  })

  it('sin período no inventa semáforo: health_status null', async () => {
    const uc = new ListReportsWithMetricsUseCase(repoCon({
      ...base, period_start: '', period_end: '', portal_visits: 100, in_person_visits: 0,
    }))
    const { results } = await uc.execute('org', { page: 1, page_size: 10 })
    expect(results[0].health_status).toBeNull()
  })
})
