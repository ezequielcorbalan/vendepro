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

  it('sorts listings with reports first and no-reports last (cola de carga)', async () => {
    const repo = makeRepo()
    repo.getActiveListingsWithAggregates.mockResolvedValue([
      {
        property_id: 'p2', address: 'Sin reportes 1', neighborhood: 'Belgrano',
        reports_count: 0, total_portal_visits: 0, total_in_person_visits: 0,
        total_days: 0,
        latest_report_published_at: null, latest_report_period_label: null,
      },
      {
        property_id: 'p1', address: 'Palermo 1', neighborhood: 'Palermo',
        reports_count: 3, total_portal_visits: 600, total_in_person_visits: 5,
        total_days: 30,
        latest_report_published_at: '2026-04-10', latest_report_period_label: 'Abril 2026',
      },
    ])
    repo.getSoldBenchmarkByNeighborhood.mockResolvedValue([])

    const useCase = new GetActiveListingsWithBenchmarkUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result[0]?.property_id).toBe('p1') // con reportes primero
    expect(result[1]?.property_id).toBe('p2') // sin reportes al final
  })

  it('sorts worst delta first among listings with reports', async () => {
    const repo = makeRepo()
    repo.getActiveListingsWithAggregates.mockResolvedValue([
      {
        property_id: 'ok', address: 'Anda bien', neighborhood: 'Centro',
        reports_count: 1, total_portal_visits: 540, total_in_person_visits: 2,
        total_days: 30, // 18 vis/día → delta -10%
        latest_report_published_at: '2026-04-10', latest_report_period_label: 'Abril',
      },
      {
        property_id: 'mal', address: 'Anda mal', neighborhood: 'Centro',
        reports_count: 1, total_portal_visits: 150, total_in_person_visits: 1,
        total_days: 30, // 5 vis/día → delta -75%
        latest_report_published_at: '2026-04-10', latest_report_period_label: 'Abril',
      },
      {
        property_id: 'sin-bench', address: 'Sin benchmark', neighborhood: 'Otro',
        reports_count: 1, total_portal_visits: 300, total_in_person_visits: 1,
        total_days: 30, // delta null → después de los que tienen delta
        latest_report_published_at: '2026-04-10', latest_report_period_label: 'Abril',
      },
    ])
    repo.getSoldBenchmarkByNeighborhood.mockResolvedValue([
      { neighborhood: 'Centro', total_portal_visits: 600, total_days: 30 }, // 20 vis/día
    ])

    const useCase = new GetActiveListingsWithBenchmarkUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result.map(r => r.property_id)).toEqual(['mal', 'ok', 'sin-bench'])
  })

  it('matches the sold benchmark across neighborhood spelling variants', async () => {
    const repo = makeRepo()
    repo.getActiveListingsWithAggregates.mockResolvedValue([
      {
        property_id: 'p1', address: 'Bauness 2906', neighborhood: 'villa urquiza ',
        reports_count: 1, total_portal_visits: 300, total_in_person_visits: 2,
        total_days: 30, // 10 vis/día
        latest_report_published_at: '2026-04-10', latest_report_period_label: 'Abril',
      },
    ])
    // Dos variantes del mismo barrio: se suman visitas y días antes de dividir.
    repo.getSoldBenchmarkByNeighborhood.mockResolvedValue([
      { neighborhood: 'Villa Urquiza', total_portal_visits: 400, total_days: 20 },
      { neighborhood: 'Villa Urquíza', total_portal_visits: 200, total_days: 10 },
    ])

    const useCase = new GetActiveListingsWithBenchmarkUseCase(repo)
    const result = await useCase.execute('org_mg')

    expect(result[0]?.neighborhood_sold_avg_views_per_day).toBe(20) // 600/30
    expect(result[0]?.delta_vs_neighborhood_pct).toBe(-50)
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
