import type { PropertyLinkRepository } from '@vendepro/core'

export class D1PropertyLinkRepository implements PropertyLinkRepository {
  constructor(private readonly db: D1Database) {}

  async findPropertyId(orgId: string, provider: string, externalId: string): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT property_id FROM property_links WHERE org_id = ? AND provider = ? AND external_id = ?')
      .bind(orgId, provider, externalId)
      .first<{ property_id: string }>()
    return row?.property_id ?? null
  }

  async save(orgId: string, provider: string, externalId: string, propertyId: string, externalCode?: string | null): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO property_links (org_id, provider, external_id, property_id, external_code) VALUES (?,?,?,?,?)')
      .bind(orgId, provider, externalId, propertyId, externalCode ?? null)
      .run()
  }
}
