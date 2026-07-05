import type { IntegrationLinkRepository } from '@vendepro/core'

export class D1IntegrationLinkRepository implements IntegrationLinkRepository {
  constructor(private readonly db: D1Database) {}

  async findContactId(orgId: string, provider: string, externalId: string): Promise<string | null> {
    const row = await this.db
      .prepare(`SELECT contact_id FROM integration_links WHERE org_id = ? AND provider = ? AND external_id = ?`)
      .bind(orgId, provider, externalId)
      .first() as any
    return row?.contact_id ?? null
  }

  async findContactIds(orgId: string, provider: string, externalIds: string[]): Promise<Record<string, string>> {
    if (externalIds.length === 0) return {}
    const placeholders = externalIds.map(() => '?').join(',')
    const rows = (await this.db
      .prepare(`SELECT external_id, contact_id FROM integration_links WHERE org_id = ? AND provider = ? AND external_id IN (${placeholders})`)
      .bind(orgId, provider, ...externalIds)
      .all()).results as any[]
    const map: Record<string, string> = {}
    for (const r of rows) map[r.external_id] = r.contact_id
    return map
  }

  async save(orgId: string, provider: string, externalId: string, contactId: string): Promise<void> {
    await this.db
      .prepare(`INSERT OR IGNORE INTO integration_links (org_id, provider, external_id, contact_id) VALUES (?,?,?,?)`)
      .bind(orgId, provider, externalId, contactId)
      .run()
  }
}
