import type { LandingTemplateRepository } from '../../ports/repositories/landing-template-repository'
import { LandingTemplate } from '../../../domain/entities/landing-template'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { canManageTemplates, type Actor } from '../../../domain/rules/landing-rules'

export class UpdateTemplateUseCase {
  constructor(private readonly templates: LandingTemplateRepository) {}

  async execute(input: {
    actor: Actor
    orgId: string
    templateId: string
    patch: Partial<{ name: string; description: string | null; preview_image_url: string | null; blocks: Block[]; active: boolean; sort_order: number }>
  }): Promise<void> {
    if (!canManageTemplates(input.actor)) throw new UnauthorizedError()
    const tpl = await this.templates.findById(input.templateId)
    if (!tpl) throw new NotFoundError('Template', input.templateId)
    if (tpl.org_id !== null && tpl.org_id !== input.orgId) throw new UnauthorizedError('Fuera de alcance multi-tenant')

    const obj = tpl.toObject()
    const merged = { ...obj, ...input.patch, updated_at: new Date().toISOString() }
    const next = LandingTemplate.create(merged)
    await this.templates.save(next)
  }
}
