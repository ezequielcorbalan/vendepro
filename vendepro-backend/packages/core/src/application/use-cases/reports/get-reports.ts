import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { Report } from '../../../domain/entities/report'

export class GetReportsUseCase {
  constructor(private readonly repo: ReportRepository) {}

  async execute(orgId: string, propertyId?: string): Promise<Report[]> {
    return this.repo.findByOrg(orgId, propertyId)
  }
}
