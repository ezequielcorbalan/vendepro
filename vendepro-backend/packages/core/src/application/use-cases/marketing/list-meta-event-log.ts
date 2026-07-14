import type { MetaEventLogRepository } from '../../ports/repositories/meta-event-log-repository'
import type { MetaEventLog } from '../../../domain/entities/meta-event-log'

export class ListMetaEventLogUseCase {
  constructor(private readonly repo: MetaEventLogRepository) {}

  /**
   * Con `agentId` devuelve los eventos de ese agente ("mis eventos");
   * sin él, todos los de la org (vista admin).
   */
  async execute(orgId: string, limit = 50, agentId?: string | null): Promise<MetaEventLog[]> {
    const capped = Math.min(limit, 200)
    return agentId
      ? this.repo.findRecentByAgent(agentId, capped)
      : this.repo.findRecentByOrg(orgId, capped)
  }
}
