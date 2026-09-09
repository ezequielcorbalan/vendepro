import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { AgentProfileRepository } from '../../ports/repositories/agent-profile-repository'
import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import type { Block } from '../../../domain/value-objects/block-schemas'
import type { LandingKind } from '../../../domain/entities/landing'
import { NotFoundError } from '../../../domain/errors/not-found'
import { GetPublicTagConfigUseCase, type PublicTagConfig } from '../marketing/get-public-tag-config'

export interface PublicLandingView {
  id: string
  full_slug: string
  kind: LandingKind
  blocks: Block[]
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_at: string
  /**
   * `/a/<orgSlug>/<agentSlug>` cuando `kind === 'agent_profile'` y el agente
   * tiene un perfil público con slug asignado. Sirve para que `/l/:slug`
   * emita un `<link rel="canonical">` hacia la ruta de agente y evite SEO
   * duplicado. `null` en cualquier otro caso (kind distinto, perfil sin
   * slug público, o agente sin perfil).
   */
  agent_public_path: string | null
  /**
   * Contenedor de GTM del agente dueño de la landing. La landing es el destino
   * de los anuncios y era la única página pública sin tagging: el shell hacía
   * `dataLayer.push` contra un dataLayer que no leía nadie.
   *
   * Opcional en el tipo porque el repo de integraciones es una dependencia
   * opcional del use case (los tests de landings no la inyectan).
   */
  tag?: PublicTagConfig
}

export class GetPublicLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly orgs: OrganizationRepository,
    private readonly agentProfiles: AgentProfileRepository,
    private readonly integrations?: MetaIntegrationRepository,
  ) {}

  async execute(input: { fullSlug: string }): Promise<PublicLandingView> {
    const landing = await this.landings.findByFullSlug(input.fullSlug)
    if (!landing) throw new NotFoundError('Landing', input.fullSlug)
    if (landing.status !== 'published' || !landing.published_version_id || !landing.published_at) {
      throw new NotFoundError('Landing', input.fullSlug)
    }
    const version = await this.versions.findById(landing.published_version_id)
    if (!version) throw new NotFoundError('Version', landing.published_version_id)

    const [agent_public_path, tag] = await Promise.all([
      this.resolveAgentPublicPath(landing.kind, landing.org_id, landing.agent_id),
      this.integrations
        ? new GetPublicTagConfigUseCase(this.integrations).execute(landing.agent_id)
        : Promise.resolve(undefined),
    ])

    return {
      ...(tag ? { tag } : {}),
      id: landing.id,
      full_slug: landing.full_slug,
      kind: landing.kind,
      blocks: version.blocks.filter(b => b.visible),
      seo_title: landing.seo_title,
      seo_description: landing.seo_description,
      og_image_url: landing.og_image_url,
      published_at: landing.published_at,
      agent_public_path,
    }
  }

  private async resolveAgentPublicPath(kind: LandingKind, orgId: string, agentId: string): Promise<string | null> {
    if (kind !== 'agent_profile') return null
    const profile = await this.agentProfiles.findByUserId(agentId)
    if (!profile || !profile.is_public) return null
    const org = await this.orgs.findById(orgId)
    if (!org) return null
    return `/a/${org.slug}/${profile.slug}`
  }
}
