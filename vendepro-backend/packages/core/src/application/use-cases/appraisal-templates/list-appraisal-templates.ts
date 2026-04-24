import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import type { AppraisalTemplateKind } from '../../../domain/entities/appraisal-template'

export interface ListAppraisalTemplatesInput {
  orgId: string
  kind?: AppraisalTemplateKind
  onlyActive?: boolean
}

export class ListAppraisalTemplatesUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository) {}

  async execute(input: ListAppraisalTemplatesInput) {
    const list = await this.repo.listVisibleTo(input.orgId, {
      kind: input.kind,
      onlyActive: input.onlyActive,
    })
    return list.map(t => t.toObject())
  }
}
