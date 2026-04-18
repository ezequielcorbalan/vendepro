import type { LandingTemplateRepository } from '../../ports/repositories/landing-template-repository'
import type { LandingKind } from '../../../domain/entities/landing'

export class ListTemplatesUseCase {
  constructor(private readonly templates: LandingTemplateRepository) {}
  async execute(input: { orgId: string; kind?: LandingKind }) {
    return this.templates.listVisibleTo(input.orgId, { kind: input.kind, onlyActive: true })
  }
}
