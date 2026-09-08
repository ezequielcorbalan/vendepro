import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { ReportMetricProps, ReportContentProps } from '../../../domain/entities/report'

export interface ReportDetailResult {
  report: Record<string, unknown>
  metrics: ReportMetricProps[]
  content: ReportContentProps[]
  competitors: Record<string, unknown>[]
  photos: Array<{ id: string; photo_url: string; r2_key?: string }>
}

export class GetReportDetailUseCase {
  constructor(private readonly repo: ReportRepository) {}

  async execute(id: string, orgId: string): Promise<ReportDetailResult | null> {
    const report = await this.repo.findReportRaw(id, orgId)
    if (!report) return null

    const [metrics, content, competitors, photos] = await Promise.all([
      this.repo.findMetrics(id, orgId),
      this.repo.findContent(id, orgId),
      this.repo.findCompetitorLinks(report.property_id as string, orgId),
      this.repo.findPhotosByReport(id, orgId),
    ])

    return { report, metrics, content, competitors, photos }
  }
}
