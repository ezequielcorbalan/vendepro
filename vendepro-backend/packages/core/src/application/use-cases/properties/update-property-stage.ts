import type { PropertyRepository } from '../../ports/repositories/property-repository'

export class UpdatePropertyStageUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(id: string, orgId: string, stageSlug: string): Promise<void> {
    await this.propRepo.updateStage(id, orgId, stageSlug)
  }
}
