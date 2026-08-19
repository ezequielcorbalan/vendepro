import type { FichaLinkRepository } from '../../ports/repositories/ficha-link-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { FichaLinkMode, FichaLinkPrefill } from '../../../domain/entities/ficha-link'

export interface PublicFichaLinkView {
  slug: string
  mode: FichaLinkMode
  /** false cuando el link está archivado, desactivado o ya consumido. */
  open: boolean
  prefill: FichaLinkPrefill | null
  org: {
    name: string
    logo_url: string | null
    brand_color: string | null
  }
  /** Quién recibe la ficha. Null en el link institucional. */
  agent: {
    name: string
    photo_url: string | null
  } | null
}

/**
 * Endpoint público (sin auth) de /f/<slug>. Devuelve sólo lo necesario para
 * pintar y pre-llenar el formulario: nada de ids internos, teléfonos del
 * equipo ni datos del lead más allá de lo que el propietario ya nos dio.
 */
export class GetPublicFichaLinkUseCase {
  constructor(
    private readonly repo: FichaLinkRepository,
    private readonly orgRepo: OrganizationRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(slug: string): Promise<PublicFichaLinkView | null> {
    const link = await this.repo.findBySlug(slug)
    if (!link) return null

    const org = await this.orgRepo.findById(link.org_id)
    if (!org) return null

    const agent = link.agent_id
      ? await this.userRepo.findById(link.agent_id, link.org_id).catch(() => null)
      : null

    return {
      slug: link.slug,
      mode: link.mode,
      open: link.acceptsSubmissions(),
      prefill: link.prefill,
      org: {
        name: org.name,
        logo_url: org.logo_url,
        brand_color: org.brand_color,
      },
      agent: agent ? { name: agent.full_name, photo_url: agent.photo_url } : null,
    }
  }
}
