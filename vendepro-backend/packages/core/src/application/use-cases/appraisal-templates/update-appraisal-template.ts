import { AppraisalTemplate } from '../../../domain/entities/appraisal-template'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import type { AppraisalTemplateBlock } from '../../../domain/value-objects/appraisal-block-schemas'

export interface UpdateAppraisalTemplateInput {
  id: string
  orgId: string
  name?: string
  description?: string | null
  preview_image_url?: string | null
  blocks?: AppraisalTemplateBlock[]
  active?: boolean
  sort_order?: number
}

export class UpdateAppraisalTemplateUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository) {}

  async execute(input: UpdateAppraisalTemplateInput): Promise<{ updated: boolean }> {
    const current = await this.repo.findById(input.id)
    if (!current) throw new ValidationError('Template no encontrado')
    if (current.isSystem()) throw new ValidationError('No se puede editar un template del sistema directamente — duplicarlo primero')
    if (current.org_id !== input.orgId) throw new ValidationError('Template pertenece a otra org')

    const cur = current.toObject()
    const next = AppraisalTemplate.create({
      id: cur.id,
      org_id: cur.org_id,
      kind: cur.kind,
      name: input.name ?? cur.name,
      description: input.description !== undefined ? input.description : cur.description,
      preview_image_url: input.preview_image_url !== undefined ? input.preview_image_url : cur.preview_image_url,
      blocks: input.blocks ?? cur.blocks,
      is_system: cur.is_system,
      parent_template_id: cur.parent_template_id,
      active: input.active !== undefined ? input.active : cur.active,
      sort_order: input.sort_order !== undefined ? input.sort_order : cur.sort_order,
      created_at: cur.created_at,
      updated_at: new Date().toISOString(),
    })
    await this.repo.save(next)
    return { updated: true }
  }
}
