import type { MetaEventLogRepository } from '../../ports/repositories/meta-event-log-repository'
import type { MetaEventLog } from '../../../domain/entities/meta-event-log'

export class ListMetaEventLogUseCase {
  constructor(private readonly repo: MetaEventLogRepository) {}

  async execute(orgId: string, limit = 50): Promise<MetaEventLog[]> {
    return this.repo.findRecentByOrg(orgId, Math.min(limit, 200))
  }
}
