import type {
  AnalyticsReportRepository,
  ReportListRow,
  ReportsListFilters,
} from '../../ports/repositories/analytics-report-repository'
import {
  computeHealthStatus,
  daysBetweenISO,
  type HealthStatus,
} from '../../../domain/rules/report-health-rules'

/** Fila del listado con los campos calculados que consume la UI. */
export interface ReportListItemEnriched extends ReportListRow {
  days_in_period: number
  views_per_day: number
  in_person_visits_per_week: number
  health_status: HealthStatus | null
}

export interface PaginatedReportsEnriched {
  total: number
  results: ReportListItemEnriched[]
}

export class ListReportsWithMetricsUseCase {
  constructor(private readonly repo: AnalyticsReportRepository) {}

  async execute(orgId: string, filters: ReportsListFilters): Promise<PaginatedReportsEnriched> {
    const { total, results } = await this.repo.listReportsWithMetrics(orgId, filters)
    return {
      total,
      // El semáforo y las tasas se calculan acá y no en el adapter SQL: son
      // regla de dominio (report-health-rules). En el refactor hexagonal estos
      // campos quedaron en el camino — el listado los esperaba y recibía
      // undefined, así que la columna Vis/día salía vacía y el semáforo
      // mostraba "Sin datos" en todas las filas.
      results: results.map((r) => {
        const hasPeriod = Boolean(r.period_start && r.period_end)
        const days = daysBetweenISO(r.period_start ?? '', r.period_end ?? '')
        const viewsPerDay = Math.round((Number(r.portal_visits ?? 0) / days) * 10) / 10
        const visitsPerWeek = Math.round((Number(r.in_person_visits ?? 0) / (days / 7)) * 10) / 10
        return {
          ...r,
          days_in_period: days,
          views_per_day: viewsPerDay,
          in_person_visits_per_week: visitsPerWeek,
          health_status: hasPeriod ? computeHealthStatus(viewsPerDay) : null,
        }
      }),
    }
  }
}
