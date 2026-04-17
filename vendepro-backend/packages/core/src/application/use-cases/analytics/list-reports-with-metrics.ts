import type {
  AnalyticsReportRepository,
  PaginatedReports,
  ReportsListFilters,
} from '../../ports/repositories/analytics-report-repository'

export class ListReportsWithMetricsUseCase {
  constructor(private readonly repo: AnalyticsReportRepository) {}

  async execute(orgId: string, filters: ReportsListFilters): Promise<PaginatedReports> {
    return this.repo.listReportsWithMetrics(orgId, filters)
  }
}
