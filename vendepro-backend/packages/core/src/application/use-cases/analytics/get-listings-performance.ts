import type {
  AnalyticsReportRepository,
  NeighborhoodPerformanceRow,
  TimelinePointRow,
} from '../../ports/repositories/analytics-report-repository'
import type { AnalyticsPeriod } from '../../../domain/value-objects/analytics-period'
import { periodStartDate } from '../../../domain/value-objects/analytics-period'

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
}

export interface NeighborhoodPerformance extends NeighborhoodPerformanceRow {}

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

export class GetListingsPerformanceUseCase {
  constructor(private readonly repo: AnalyticsReportRepository) {}

  async execute(params: {
    orgId: string
    period: AnalyticsPeriod
    source: string | null
    now?: Date
  }): Promise<ListingsPerformanceResult> {
    const now = params.now ?? new Date()
    const end = now.toISOString().split('T')[0] ?? ''
    const start = periodStartDate(params.period, now)

    const [totals, byNeighborhood, timelineRows] = await Promise.all([
      this.repo.getPerformanceTotals(params.orgId, start, end, params.source),
      this.repo.getNeighborhoodPerformance(params.orgId, start, end, params.source),
      this.repo.getTimelinePerformance(params.orgId, start, end, params.source),
    ])

    const count = totals.reports_published
    const safeAvg = (total: number): number => count > 0 ? Math.round(total / count) : 0
    const avgFloat = (total: number): number => count > 0 ? Math.round((total / count) * 100) / 100 : 0

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
    }

    return {
      period: params.period,
      start,
      end,
      kpis,
      by_neighborhood: byNeighborhood,
      timeline: timelineRows.map(buildTimelinePoint),
    }
  }
}
