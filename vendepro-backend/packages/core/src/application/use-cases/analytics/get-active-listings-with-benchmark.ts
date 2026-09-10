import type {
  AnalyticsReportRepository,
  ListingFilters,
} from '../../ports/repositories/analytics-report-repository'
import {
  computeDeltaHealthStatus,
  type HealthStatus,
} from '../../../domain/rules/report-health-rules'
import { neighborhoodKey } from '../../../domain/rules/neighborhood-key'

export interface ActiveListingWithBenchmark {
  property_id: string
  address: string
  neighborhood: string
  reports_count: number
  avg_views_per_day: number
  avg_in_person_visits_per_week: number
  latest_report_published_at: string | null
  latest_report_period_label: string | null
  neighborhood_sold_avg_views_per_day: number | null
  delta_vs_neighborhood_pct: number | null
  delta_health_status: HealthStatus
}

export class GetActiveListingsWithBenchmarkUseCase {
  constructor(private readonly repo: AnalyticsReportRepository) {}

  async execute(orgId: string, listingFilters?: ListingFilters | null): Promise<ActiveListingWithBenchmark[]> {
    const filters = listingFilters ?? null
    const [listings, soldBenchmarks] = await Promise.all([
      this.repo.getActiveListingsWithAggregates(orgId, filters),
      this.repo.getSoldBenchmarkByNeighborhood(orgId, filters),
    ])

    // El barrio es texto libre ("Villa Urquiza" / "villa urquiza " / con tilde),
    // así que el benchmark se acumula por clave normalizada: primero se suman
    // visitas y días de todas las variantes, recién después se divide.
    const benchmarkTotals = new Map<string, { portal: number; days: number }>()
    for (const row of soldBenchmarks) {
      const key = neighborhoodKey(row.neighborhood)
      const acc = benchmarkTotals.get(key) ?? { portal: 0, days: 0 }
      acc.portal += row.total_portal_visits
      acc.days += Math.max(1, row.total_days)
      benchmarkTotals.set(key, acc)
    }
    const benchmarkByNeighborhood = new Map<string, number>()
    for (const [key, acc] of benchmarkTotals) {
      benchmarkByNeighborhood.set(key, Math.round((acc.portal / Math.max(1, acc.days)) * 10) / 10)
    }

    const rows = listings.map(r => {
      const days = Math.max(1, r.total_days)
      const viewsPerDay = r.reports_count > 0 ? Math.round((r.total_portal_visits / days) * 10) / 10 : 0
      const visitsPerWeek = r.reports_count > 0 ? Math.round((r.total_in_person_visits / (days / 7)) * 10) / 10 : 0

      const benchmark = benchmarkByNeighborhood.get(neighborhoodKey(r.neighborhood)) ?? null
      let delta: number | null = null
      if (r.reports_count > 0 && benchmark !== null && benchmark > 0) {
        delta = Math.round(((viewsPerDay - benchmark) / benchmark) * 1000) / 10
      }

      return {
        property_id: r.property_id,
        address: r.address,
        neighborhood: r.neighborhood,
        reports_count: r.reports_count,
        avg_views_per_day: viewsPerDay,
        avg_in_person_visits_per_week: visitsPerWeek,
        latest_report_published_at: r.latest_report_published_at,
        latest_report_period_label: r.latest_report_period_label,
        neighborhood_sold_avg_views_per_day: benchmark,
        delta_vs_neighborhood_pct: delta,
        delta_health_status: computeDeltaHealthStatus(delta),
      }
    })

    // Orden: primero las que tienen reportes (peor delta arriba — es lo que
    // promete el subtítulo de la tabla), después las sin benchmark, y al final
    // las que nunca tuvieron reporte: son una cola de carga, no de análisis.
    return rows.sort((a, b) => {
      if (a.reports_count === 0 && b.reports_count > 0) return 1
      if (b.reports_count === 0 && a.reports_count > 0) return -1
      if (a.reports_count === 0 && b.reports_count === 0) return 0

      const aDelta = a.delta_vs_neighborhood_pct
      const bDelta = b.delta_vs_neighborhood_pct
      if (aDelta === null && bDelta === null) return 0
      if (aDelta === null) return 1
      if (bDelta === null) return -1
      return aDelta - bDelta
    })
  }
}
