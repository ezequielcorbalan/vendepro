import type {
  AnalyticsReportRepository,
  ListingFilters,
  NeighborhoodPerformanceRow,
  TimelinePointRow,
} from '../../ports/repositories/analytics-report-repository'
import type { AnalyticsPeriod } from '../../../domain/value-objects/analytics-period'
import { periodStartDate } from '../../../domain/value-objects/analytics-period'
import {
  REPORT_HEALTH_BENCHMARKS,
  computeHealthStatus,
  type HealthStatus,
} from '../../../domain/rules/report-health-rules'

export interface PerformanceKpis {
  reports_published: number
  total_impressions: number
  total_portal_visits: number
  total_in_person_visits: number
  total_offers: number
  avg_impressions_per_report: number
  avg_portal_visits_per_report: number
  avg_in_person_visits_per_report: number
  avg_offers_per_report: number
  /** Métricas del semáforo (Marcela Genta). */
  avg_views_per_day: number
  avg_in_person_visits_per_week: number
  overall_health_status: HealthStatus
}

export interface NeighborhoodPerformance {
  neighborhood: string
  reports_count: number
  avg_impressions: number
  avg_portal_visits: number
  avg_in_person_visits: number
  avg_offers: number
  total_offers: number
  avg_views_per_day: number
  avg_in_person_visits_per_week: number
  health_status: HealthStatus
}

export interface TimelinePoint {
  period_label: string
  period_start: string
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
}

export interface ListingsPerformanceResult {
  period: AnalyticsPeriod
  start: string
  end: string
  kpis: PerformanceKpis
  by_neighborhood: NeighborhoodPerformance[]
  timeline: TimelinePoint[]
  benchmarks: typeof REPORT_HEALTH_BENCHMARKS
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function buildTimelinePoint(row: TimelinePointRow): TimelinePoint {
  const [year = '', month = '01'] = (row.month_key ?? '').split('-')
  const idx = parseInt(month, 10) - 1
  const label = `${MONTH_LABELS[idx] ?? month} ${year}`.trim()
  return {
    period_label: label,
    period_start: `${year}-${month}-01`,
    impressions: row.impressions,
    portal_visits: row.portal_visits,
    in_person_visits: row.in_person_visits,
    offers: row.offers,
  }
}

function mapNeighborhood(row: NeighborhoodPerformanceRow): NeighborhoodPerformance {
  const days = Math.max(1, row.total_days)
  const viewsPerDay = row.total_portal_visits / days
  const inPersonPerWeek = (row.total_in_person_visits / days) * 7
  return {
    neighborhood: row.neighborhood,
    reports_count: row.reports_count,
    avg_impressions: row.avg_impressions,
    avg_portal_visits: row.avg_portal_visits,
    avg_in_person_visits: row.avg_in_person_visits,
    avg_offers: row.avg_offers,
    total_offers: row.total_offers,
    avg_views_per_day: Math.round(viewsPerDay * 10) / 10,
    avg_in_person_visits_per_week: Math.round(inPersonPerWeek * 10) / 10,
    health_status: computeHealthStatus(viewsPerDay),
  }
}

export class GetListingsPerformanceUseCase {
  constructor(private readonly repo: AnalyticsReportRepository) {}

  async execute(params: {
    orgId: string
    period: AnalyticsPeriod
    source: string | null
    listingFilters?: ListingFilters | null
    now?: Date
  }): Promise<ListingsPerformanceResult> {
    const now = params.now ?? new Date()
    const end = now.toISOString().split('T')[0] ?? ''
    const start = periodStartDate(params.period, now)
    const filters = params.listingFilters ?? null

    const [totals, byNeighborhood, timelineRows] = await Promise.all([
      this.repo.getPerformanceTotals(params.orgId, start, end, params.source, filters),
      this.repo.getNeighborhoodPerformance(params.orgId, start, end, params.source, filters),
      this.repo.getTimelinePerformance(params.orgId, start, end, params.source, filters),
    ])

    const count = totals.reports_published
    const safeAvg = (total: number): number => count > 0 ? Math.round(total / count) : 0
    const avgFloat = (total: number): number => count > 0 ? Math.round((total / count) * 100) / 100 : 0

    const days = Math.max(1, totals.total_days)
    const viewsPerDay = count > 0 ? totals.total_portal_visits / days : 0
    const inPersonPerWeek = count > 0 ? (totals.total_in_person_visits / days) * 7 : 0

    const kpis: PerformanceKpis = {
      reports_published: count,
      total_impressions: totals.total_impressions,
      total_portal_visits: totals.total_portal_visits,
      total_in_person_visits: totals.total_in_person_visits,
      total_offers: totals.total_offers,
      avg_impressions_per_report: safeAvg(totals.total_impressions),
      avg_portal_visits_per_report: safeAvg(totals.total_portal_visits),
      avg_in_person_visits_per_report: safeAvg(totals.total_in_person_visits),
      avg_offers_per_report: avgFloat(totals.total_offers),
      avg_views_per_day: Math.round(viewsPerDay * 10) / 10,
      avg_in_person_visits_per_week: Math.round(inPersonPerWeek * 10) / 10,
      overall_health_status: count > 0 ? computeHealthStatus(viewsPerDay) : 'red',
    }

    return {
      period: params.period,
      start,
      end,
      kpis,
      by_neighborhood: byNeighborhood.map(mapNeighborhood),
      timeline: timelineRows.map(buildTimelinePoint),
      benchmarks: REPORT_HEALTH_BENCHMARKS,
    }
  }
}
