import type { PortalFeedRepository } from '../../ports/repositories/portal-feed-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import { buildZonapropFeed, type BuildFeedResult } from './zonaprop-feed-mapper'

export interface GetPortalFeedResult extends BuildFeedResult {
  orgId: string
  portal: string
}

/**
 * Sirve el feed XML que el portal crawlea. Sin auth: la protección es el
 * token opaco en la URL. Devuelve null cuando el token no existe o el feed
 * está deshabilitado, para que la ruta responda 404 sin filtrar cuál de los
 * dos casos fue.
 */
export class GetPortalFeedUseCase {
  constructor(
    private readonly feeds: PortalFeedRepository,
    private readonly orgs: OrganizationRepository,
    private readonly publicBaseUrl: string,
  ) {}

  async execute(token: string): Promise<GetPortalFeedResult | null> {
    const feed = await this.feeds.findByToken(token)
    if (!feed || !feed.enabled) return null

    const [properties, org] = await Promise.all([
      this.feeds.findPublishableProperties(feed.org_id),
      this.orgs.findById(feed.org_id),
    ])

    const result = buildZonapropFeed({
      properties,
      advertiser: {
        // El anunciante del feed puede diferir del nombre de la org
        // (ej. un 0800 comercial en vez del teléfono del dueño).
        name: feed.advertiser_name ?? org?.name ?? 'Inmobiliaria',
        email: feed.advertiser_email,
        phone: feed.advertiser_phone,
      },
      publicBaseUrl: this.publicBaseUrl,
    })

    // No await: la telemetría del crawl no debe demorar la respuesta al
    // portal ni tumbar el feed si falla el write.
    void this.feeds.recordFetch(feed.id, new Date().toISOString()).catch(() => {})

    return { ...result, orgId: feed.org_id, portal: feed.portal }
  }
}
