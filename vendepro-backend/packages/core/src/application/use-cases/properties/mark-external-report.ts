import type { PropertyRepository } from '../../ports/repositories/property-repository'

export class MarkExternalReportUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    await this.propRepo.markExternalReport(id, orgId)
  }
}

export class ClearExternalReportUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    await this.propRepo.clearExternalReport(id, orgId)
  }
}
