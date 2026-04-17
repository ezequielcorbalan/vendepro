import type { LeadRepository } from '../../ports/repositories/lead-repository'

export class GetPendingFollowupsUseCase {
  constructor(private readonly repo: LeadRepository) {}

  async execute(orgId: string, limit = 10): Promise<Array<{ id: string; full_name: string; next_step: string | null; next_step_date: string | null; stage: string }>> {
    try {
      const now = new Date().toISOString()
      return await this.repo.findPendingFollowups(orgId, now, limit)
    } catch {
      return []
    }
  }
}
