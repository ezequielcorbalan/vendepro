import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { Property } from '../../../domain/entities/property'
import type { Report } from '../../../domain/entities/report'

export interface GetPublicReportResult {
  property: Property
  report: Report | null
}

export class GetPublicReportUseCase {
  constructor(
    private readonly propertyRepo: PropertyRepository,
    private readonly reportRepo: ReportRepository,
  ) {}

  async execute(slug: string): Promise<GetPublicReportResult | null> {
    const property = await this.propertyRepo.findByPublicSlug(slug)
    if (!property) return null

    const report = await this.reportRepo.findLatestPublishedByProperty(property.id)

    return { property, report }
  }
}
