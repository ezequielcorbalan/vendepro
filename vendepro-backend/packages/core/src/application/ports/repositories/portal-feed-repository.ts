import type { FeedProperty } from '../../use-cases/portals/zonaprop-feed-mapper'

export interface PortalFeed {
  id: string
  org_id: string
  portal: string
  token: string
  enabled: boolean
  advertiser_name: string | null
  advertiser_email: string | null
  advertiser_phone: string | null
  last_fetched_at: string | null
  fetch_count: number
}

export interface PortalFeedRepository {
  /** Resuelve el feed por el token de la URL pública. null si no existe. */
  findByToken(token: string): Promise<PortalFeed | null>

  findByOrg(orgId: string, portal: string): Promise<PortalFeed | null>

  /**
   * Propiedades elegibles: activas, con `publish_portals = 1`, con sus fotos
   * ya ordenadas. La query vive en el repo porque el JOIN con
   * `property_photos` es específico de D1.
   */
  findPublishableProperties(orgId: string): Promise<FeedProperty[]>

  /** Registra que el portal leyó el feed (telemetría del crawl). */
  recordFetch(feedId: string, at: string): Promise<void>
}
