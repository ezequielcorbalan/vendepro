import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LeadRules } from '../../../domain/entities/landing'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { canEditLanding, type Actor } from '../../../domain/rules/landing-rules'

export class UpdateLandingMetadataUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: {
    actor: Actor
    orgId: string
    landingId: string
    patch: Partial<{ brand_voice: string | null; lead_rules: LeadRules | null; seo_title: string | null; seo_description: string | null; og_image_url: string | null; slug_base: string }>
  }): Promise<void> {
    const l = await this.landings.findById(input.landingId, input.orgId)
    if (!l) throw new NotFoundError('Landing', input.landingId)
    if (!canEditLanding(input.actor, { agent_id: l.agent_id, status: l.status })) throw new UnauthorizedError()

    if (input.patch.slug_base && input.patch.slug_base !== l.slug_base) {
      const nextFull = `${input.patch.slug_base}-${l.slug_suffix}`
      if (await this.landings.existsFullSlug(nextFull)) {
        throw new Error(`El slug "${input.patch.slug_base}" colisiona. Elegí otro.`)
      }
    }
    const updated = l.updateMetadata(input.patch)
    await this.landings.save(updated)
  }
}
