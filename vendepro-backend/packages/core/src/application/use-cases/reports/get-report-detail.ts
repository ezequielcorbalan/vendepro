import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { ReportMetricProps, ReportContentProps } from '../../../domain/entities/report'

export interface ReportDetailResult {
  report: Record<string, unknown>
  metrics: ReportMetricProps[]
  content: ReportContentProps[]
  competitors: Record<string, unknown>[]
}

export class GetReportDetailUseCase {
  constructor(private readonly repo: ReportRepository) {}

  async execute(id: string, orgId: string): Promise<ReportDetailResult | null> {
    const report = await this.repo.findReportRaw(id)
    if (!report) return null
    // Security: check org_id matches if available
    if (report.org_id && report.org_id !== orgId) return null

    const [metrics, content, competitors] = await Promise.all([
      this.repo.findMetrics(id),
      this.repo.findContent(id),
      this.repo.findCompetitorLinks(report.property_id as string),
    ])

    return { report, metrics, content, competitors }
  }
}
