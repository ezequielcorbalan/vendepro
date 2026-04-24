import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'

export class GetAppraisalTemplateUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository) {}

  async execute(input: { id: string; orgId: string }) {
    const t = await this.repo.findById(input.id)
    if (!t) return null
    if (t.org_id !== null && t.org_id !== input.orgId) return null
    return t.toObject()
  }
}
