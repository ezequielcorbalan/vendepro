import type { Objective } from '../../../domain/entities/objective'

export interface ObjectiveFilters {
  agent_id?: string
  period_type?: string
}

export interface ObjectiveRepository {
  findByAgent(agentId: string, orgId: string): Promise<Objective[]>
  findByOrg(orgId: string, filters?: ObjectiveFilters): Promise<Objective[]>
  save(objective: Objective): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
