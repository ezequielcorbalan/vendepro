import { AppraisalTemplate } from '../../../domain/entities/appraisal-template'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import type { AppraisalTemplateKind } from '../../../domain/entities/appraisal-template'
import type { AppraisalTemplateBlock } from '../../../domain/value-objects/appraisal-block-schemas'
import type { IdGenerator } from '../../ports/id-generator'

export interface CreateAppraisalTemplateInput {
  orgId: string
  agentId?: string | null
  name: string
  kind: AppraisalTemplateKind
  description?: string | null
  preview_image_url?: string | null
  blocks?: AppraisalTemplateBlock[]
}

export class CreateAppraisalTemplateUseCase {
  constructor(
    private readonly repo: AppraisalTemplateRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateAppraisalTemplateInput): Promise<{ id: string }> {
    const id = this.idGen.generate()
    const tpl = AppraisalTemplate.create({
      id,
      org_id: input.orgId,
      agent_id: input.agentId ?? null,
      kind: input.kind,
      name: input.name,
      description: input.description ?? null,
      preview_image_url: input.preview_image_url ?? null,
      blocks: input.blocks ?? [],
      is_system: false,
      parent_template_id: null,
      active: true,
      sort_order: 0,
    })
    await this.repo.save(tpl)
    return { id }
  }
}
