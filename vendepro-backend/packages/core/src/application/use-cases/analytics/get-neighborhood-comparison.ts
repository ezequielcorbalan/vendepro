import type {
  AnalyticsReportRepository,
  ListingFilters,
  NeighborhoodGroupTotals,
} from '../../ports/repositories/analytics-report-repository'
import {
  computeDeltaHealthStatus,
  type HealthStatus,
} from '../../../domain/rules/report-health-rules'

export interface NeighborhoodGroupMetrics {
  property_count: number
  reports_count: number
  avg_views_per_day: number
  avg_portal_visits_per_report: number
  avg_in_person_visits_per_week: number
  avg_inquiries_per_report: number
}

export interface NeighborhoodComparison {
  neighborhood: string
  sold: NeighborhoodGroupMetrics | null
  active: NeighborhoodGroupMetrics | null
  delta_views_per_day_pct: number | null
  delta_health_status: HealthStatus
}

function toMetrics(row: NeighborhoodGroupTotals | undefined): NeighborhoodGroupMetrics | null {
  if (!row || row.reports_count === 0) return null
  const days = Math.max(1, row.total_days)
  return {
    property_count: row.property_count,
    reports_count: row.reports_count,
    avg_views_per_day: Math.round((row.total_portal_visits / days) * 10) / 10,
    avg_portal_visits_per_report: Math.round(row.total_portal_visits / row.reports_count),
    avg_in_person_visits_per_week: Math.round((row.total_in_person_visits / (days / 7)) * 10) / 10,
    avg_inquiries_per_report: Math.round((row.total_inquiries / row.reports_count) * 10) / 10,
  }
}

export class GetNeighborhoodComparisonUseCase {
  constructor(private readonly repo: AnalyticsReportRepository) {}

  async execute(orgId: string, listingFilters?: ListingFilters | null): Promise<NeighborhoodComparison[]> {
    const filters = listingFilters ?? null
    const [soldRows, activeRows] = await Promise.all([
      this.repo.getNeighborhoodTotalsByPropertyStatus(orgId, 'sold', filters),
      this.repo.getNeighborhoodTotalsByPropertyStatus(orgId, 'active', filters),
    ])

    const neighborhoods = new Set<string>([
      ...soldRows.map(r => r.neighborhood),
      ...activeRows.map(r => r.neighborhood),
    ])

    const results = [...neighborhoods].map(n => {
      const sold = toMetrics(soldRows.find(r => r.neighborhood === n))
      const active = toMetrics(activeRows.find(r => r.neighborhood === n))

      let delta: number | null = null
      if (sold && active && sold.avg_views_per_day > 0) {
        delta = Math.round(((active.avg_views_per_day - sold.avg_views_per_day) / sold.avg_views_per_day) * 1000) / 10
      }

      return {
        neighborhood: n,
        sold,
        active,
        delta_views_per_day_pct: delta,
        delta_health_status: computeDeltaHealthStatus(delta),
      }
    })

    // Barrios con más reports activos primero
    return results.sort((a, b) => (b.active?.reports_count ?? 0) - (a.active?.reports_count ?? 0))
  }
}
