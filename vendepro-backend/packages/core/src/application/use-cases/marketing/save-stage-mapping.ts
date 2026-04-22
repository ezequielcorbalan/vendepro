import type { StageEventMappingRepository } from '../../ports/repositories/stage-event-mapping-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { StageEventMapping } from '../../../domain/entities/stage-event-mapping'

export interface SaveStageMappingInput {
  orgId: string
  stage_key: string
  meta_event_name: string
  enabled?: boolean
}

export class SaveStageMappingUseCase {
  constructor(
    private readonly repo: StageEventMappingRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SaveStageMappingInput): Promise<{ id: string }> {
    const existing = await this.repo.findByOrgAndStage(input.orgId, input.stage_key)
    if (existing) {
      existing.update({
        meta_event_name: input.meta_event_name,
        enabled: input.enabled ?? existing.enabled,
      })
      await this.repo.save(existing)
      return { id: existing.id }
    }

    const mapping = StageEventMapping.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      stage_key: input.stage_key,
      meta_event_name: input.meta_event_name,
      enabled: input.enabled ?? true,
    })
    await this.repo.save(mapping)
    return { id: mapping.id }
  }
}
