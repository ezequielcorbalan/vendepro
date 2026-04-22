import type { StageEventMappingRepository } from '../../ports/repositories/stage-event-mapping-repository'

export class DeleteStageMappingUseCase {
  constructor(private readonly repo: StageEventMappingRepository) {}

  async execute(id: string, orgId: string): Promise<{ ok: true }> {
    await this.repo.delete(id, orgId)
    return { ok: true }
  }
}
