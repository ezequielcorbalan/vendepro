import type { StageEventMapping } from '../../../domain/entities/stage-event-mapping'

export interface StageEventMappingRepository {
  findByOrg(orgId: string): Promise<StageEventMapping[]>
  findByOrgAndStage(orgId: string, stageKey: string): Promise<StageEventMapping | null>
  save(mapping: StageEventMapping): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
