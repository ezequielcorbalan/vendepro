import type { PortalFeed, PortalFeedRepository, FeedProperty } from '@vendepro/core'

export class D1PortalFeedRepository implements PortalFeedRepository {
  constructor(private readonly db: D1Database) {}

  async findByToken(token: string): Promise<PortalFeed | null> {
    const row = (await this.db
      .prepare('SELECT * FROM portal_feeds WHERE token = ? LIMIT 1')
      .bind(token)
      .first()) as any
    return row ? this.toFeed(row) : null
  }

  async findByOrg(orgId: string, portal: string): Promise<PortalFeed | null> {
    const row = (await this.db
      .prepare('SELECT * FROM portal_feeds WHERE org_id = ? AND portal = ? LIMIT 1')
      .bind(orgId, portal)
      .first()) as any
    return row ? this.toFeed(row) : null
  }

  async findPublishableProperties(orgId: string): Promise<FeedProperty[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, title, description, operation_type, property_type, address,
                neighborhood, city, province, postal_code, latitude, longitude,
                rooms, bathrooms, size_m2, covered_m2, parking_spaces,
                antiquity_years, expenses, expenses_currency, asking_price,
                currency, cover_photo, public_slug, updated_at
           FROM properties
          WHERE org_id = ?
            AND publish_portals = 1
            AND COALESCE(status, 'active') = 'active'
          ORDER BY updated_at DESC`,
      )
      .bind(orgId)
      .all()

    const rows = (results ?? []) as any[]
    if (rows.length === 0) return []

    // Una sola query para todas las fotos: N+1 contra D1 desde un Worker
    // agrega ~5ms por propiedad y el portal tiene timeout de crawl.
    const placeholders = rows.map(() => '?').join(',')
    const { results: photoRows } = await this.db
      .prepare(
        `SELECT property_id, url FROM property_photos
          WHERE property_id IN (${placeholders})
          ORDER BY property_id, sort_order ASC`,
      )
      .bind(...rows.map((r) => r.id))
      .all()

    const photosByProperty = new Map<string, string[]>()
    for (const p of (photoRows ?? []) as any[]) {
      const list = photosByProperty.get(p.property_id) ?? []
      list.push(p.url)
      photosByProperty.set(p.property_id, list)
    }

    return rows.map((r) => {
      // Fallback a cover_photo: hay propiedades viejas cargadas antes de
      // que existiera property_photos que sólo tienen la portada.
      const photos = photosByProperty.get(r.id) ?? (r.cover_photo ? [r.cover_photo] : [])
      return {
        id: r.id,
        title: r.title ?? null,
        description: r.description ?? null,
        operation_type: r.operation_type ?? 'venta',
        property_type: r.property_type,
        address: r.address,
        neighborhood: r.neighborhood,
        city: r.city,
        province: r.province ?? null,
        postal_code: r.postal_code ?? null,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        rooms: r.rooms ?? null,
        bathrooms: r.bathrooms ?? null,
        size_m2: r.size_m2 ?? null,
        covered_m2: r.covered_m2 ?? null,
        parking_spaces: r.parking_spaces ?? null,
        antiquity_years: r.antiquity_years ?? null,
        expenses: r.expenses ?? null,
        expenses_currency: r.expenses_currency ?? null,
        asking_price: r.asking_price ?? null,
        currency: r.currency ?? 'USD',
        photos,
        updated_at: r.updated_at,
        public_slug: r.public_slug,
      } satisfies FeedProperty
    })
  }

  async recordFetch(feedId: string, at: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE portal_feeds
            SET last_fetched_at = ?, fetch_count = fetch_count + 1, updated_at = ?
          WHERE id = ?`,
      )
      .bind(at, at, feedId)
      .run()
  }

  private toFeed(row: any): PortalFeed {
    return {
      id: row.id,
      org_id: row.org_id,
      portal: row.portal,
      token: row.token,
      enabled: row.enabled === 1,
      advertiser_name: row.advertiser_name ?? null,
      advertiser_email: row.advertiser_email ?? null,
      advertiser_phone: row.advertiser_phone ?? null,
      last_fetched_at: row.last_fetched_at ?? null,
      fetch_count: row.fetch_count ?? 0,
    }
  }
}
