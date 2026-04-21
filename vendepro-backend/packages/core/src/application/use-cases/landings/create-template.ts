import type { LandingTemplateRepository } from '../../ports/repositories/landing-template-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LandingTemplate } from '../../../domain/entities/landing-template'
import type { LandingKind } from '../../../domain/entities/landing'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { canManageTemplates, type Actor } from '../../../domain/rules/landing-rules'

export class CreateTemplateUseCase {
  constructor(
    private readonly templates: LandingTemplateRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: {
    actor: Actor
    orgId: string | null
    name: string
    kind: LandingKind
    description?: string | null
    previewImageUrl?: string | null
    blocks: Block[]
    sortOrder?: number
  }): Promise<{ templateId: string }> {
    if (!canManageTemplates(input.actor)) throw new UnauthorizedError('Solo admin puede crear templates.')

    const tpl = LandingTemplate.create({
      id: this.idGen.generate(),
      org_id: input.orgId,
      name: input.name,
      kind: input.kind,
      description: input.description ?? null,
      preview_image_url: input.previewImageUrl ?? null,
      blocks: input.blocks,
      active: true,
      sort_order: input.sortOrder ?? 100,
    })
    await this.templates.save(tpl)
    return { templateId: tpl.id }
  }
}
