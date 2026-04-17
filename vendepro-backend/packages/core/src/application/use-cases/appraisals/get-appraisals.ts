import type { AppraisalRepository, AppraisalFilters } from '../../ports/repositories/appraisal-repository'
import type { Appraisal } from '../../../domain/entities/appraisal'

export class GetAppraisalsUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(orgId: string, filters?: { stage?: string; agent_id?: string }): Promise<Appraisal[]> {
    const f: AppraisalFilters = {}
    if (filters?.stage) f.stage = filters.stage
    if (filters?.agent_id) f.agent_id = filters.agent_id
    return this.repo.findByOrg(orgId, f)
  }
}
