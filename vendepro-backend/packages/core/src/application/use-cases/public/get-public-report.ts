import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { Property } from '../../../domain/entities/property'
import type { Report } from '../../../domain/entities/report'

export interface GetPublicReportResult {
  property: Property
  report: Report
}

export class GetPublicReportUseCase {
  constructor(
    private readonly propertyRepo: PropertyRepository,
    private readonly reportRepo: ReportRepository,
  ) {}

  async execute(slug: string): Promise<GetPublicReportResult | null> {
    const found = await this.reportRepo.findPublicBySlug(slug)
    if (!found) return null

    const property = await this.propertyRepo.findById(found.propertyId, found.orgId)
    if (!property) return null

    return { property, report: found.report }
  }
}
