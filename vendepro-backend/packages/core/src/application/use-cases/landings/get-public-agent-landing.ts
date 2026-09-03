import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { AgentProfileRepository } from '../../ports/repositories/agent-profile-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { resolveAgentBindings } from '../../../domain/value-objects/agent-bindings'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface GetPublicAgentLandingInput {
  orgSlug: string
  agentSlug: string
}

export interface PublicAgentLanding {
  landing_id: string
  full_slug: string
  blocks: Block[]
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  org: {
    name: string
    logo_url: string | null
    brand_color: string | null
    brand_accent_color: string | null
  }
  agent: {
    full_name: string
    photo_url: string | null
    headline: string | null
  }
}

export class GetPublicAgentLandingUseCase {
  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly agentProfiles: AgentProfileRepository,
    private readonly users: UserRepository,
    private readonly landings: LandingRepository,
  ) {}

  async execute(input: GetPublicAgentLandingInput): Promise<PublicAgentLanding> {
    const org = await this.orgs.findBySlug(input.orgSlug)
    if (!org) throw new NotFoundError('Landing', input.agentSlug)

    const profile = await this.agentProfiles.findByOrgAndSlug(org.id, input.agentSlug)
    if (!profile || !profile.is_public) throw new NotFoundError('Landing', input.agentSlug)

    // findProfileById NO filtra por org — la comparación de org_id es obligatoria.
    const user = await this.users.findProfileById(profile.user_id)
    if (!user || user.org_id !== org.id || !user.active || user.deleted_at) {
      throw new NotFoundError('Landing', input.agentSlug)
    }

    const landing = await this.landings.findPublishedByAgentAndKind(org.id, profile.user_id, 'agent_profile')
    if (!landing) throw new NotFoundError('Landing', input.agentSlug)

    const blocks = resolveAgentBindings(landing.blocks, {
      user: { full_name: user.full_name, photo_url: user.photo_url ?? null, phone: user.phone ?? null },
      profile,
    })

    return {
      landing_id: landing.id,
      full_slug: landing.full_slug,
      blocks: blocks.filter(b => b.visible),
      seo_title: landing.seo_title,
      seo_description: landing.seo_description,
      og_image_url: landing.og_image_url,
      org: {
        name: org.name,
        logo_url: org.logo_url ?? null,
        brand_color: org.brand_color ?? null,
        brand_accent_color: org.brand_accent_color ?? null,
      },
      agent: {
        full_name: user.full_name,
        photo_url: user.photo_url ?? null,
        headline: profile.headline,
      },
    }
  }
}
