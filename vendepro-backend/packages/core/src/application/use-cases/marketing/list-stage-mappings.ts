import type { StageEventMappingRepository } from '../../ports/repositories/stage-event-mapping-repository'
import type { StageEventMapping } from '../../../domain/entities/stage-event-mapping'

export class ListStageMappingsUseCase {
  constructor(private readonly repo: StageEventMappingRepository) {}

  async execute(orgId: string): Promise<StageEventMapping[]> {
    return this.repo.findByOrg(orgId)
  }
}
