import type {
  AnalyticsReportRepository,
  ListingFilters,
  NeighborhoodGroupTotals,
} from '../../ports/repositories/analytics-report-repository'
import {
  computeDeltaHealthStatus,
  type HealthStatus,
} from '../../../domain/rules/report-health-rules'
import { neighborhoodKey } from '../../../domain/rules/neighborhood-key'

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

/**
 * El barrio es texto libre: la misma zona aparece como "Villa Urquiza",
 * "villa urquiza " o "Villa Urquíza" según quién cargó la propiedad. El SQL
 * agrupa por el string crudo, así que acá se re-agrupa por clave normalizada
 * sumando los totales; la etiqueta visible es la de la variante con más reports.
 */
function mergeByNeighborhoodKey(
  rows: NeighborhoodGroupTotals[],
): Map<string, NeighborhoodGroupTotals & { label: string }> {
  const merged = new Map<string, NeighborhoodGroupTotals & { label: string; _labelReports: number }>()
  for (const r of rows) {
    const key = neighborhoodKey(r.neighborhood)
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, { ...r, label: r.neighborhood, _labelReports: r.reports_count })
      continue
    }
    prev.property_count += r.property_count
    prev.reports_count += r.reports_count
    prev.total_portal_visits += r.total_portal_visits
    prev.total_in_person_visits += r.total_in_person_visits
    prev.total_inquiries += r.total_inquiries
    prev.total_days += r.total_days
    if (r.reports_count > prev._labelReports) {
      prev.label = r.neighborhood
      prev._labelReports = r.reports_count
    }
  }
  return merged
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

    const soldByKey = mergeByNeighborhoodKey(soldRows)
    const activeByKey = mergeByNeighborhoodKey(activeRows)
    const neighborhoods = new Set<string>([...soldByKey.keys(), ...activeByKey.keys()])

    const results = [...neighborhoods].map(key => {
      const soldRow = soldByKey.get(key)
      const activeRow = activeByKey.get(key)
      const sold = toMetrics(soldRow)
      const active = toMetrics(activeRow)

      let delta: number | null = null
      if (sold && active && sold.avg_views_per_day > 0) {
        delta = Math.round(((active.avg_views_per_day - sold.avg_views_per_day) / sold.avg_views_per_day) * 1000) / 10
      }

      return {
        neighborhood: activeRow?.label ?? soldRow?.label ?? key,
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
