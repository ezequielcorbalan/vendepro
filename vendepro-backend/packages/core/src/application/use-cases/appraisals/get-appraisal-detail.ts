import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { Appraisal, AppraisalComparableProps } from '../../../domain/entities/appraisal'

export interface AppraisalDetailResult {
  appraisal: Appraisal
  comparables: AppraisalComparableProps[]
}

export class GetAppraisalDetailUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(id: string, orgId: string): Promise<AppraisalDetailResult | null> {
    const appraisal = await this.repo.findById(id, orgId)
    if (!appraisal) return null
    const comparables = await this.repo.findComparables(id)
    return { appraisal, comparables }
  }
}
