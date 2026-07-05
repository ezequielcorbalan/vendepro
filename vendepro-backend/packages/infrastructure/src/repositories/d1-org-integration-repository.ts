import { OrgIntegration } from '@vendepro/core'
import type { OrgIntegrationRepository } from '@vendepro/core'

export class D1OrgIntegrationRepository implements OrgIntegrationRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrgAndProvider(orgId: string, provider: string): Promise<OrgIntegration | null> {
    const row = await this.db
      .prepare(`SELECT * FROM org_integrations WHERE org_id = ? AND provider = ?`)
      .bind(orgId, provider)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(integration: OrgIntegration): Promise<void> {
    const o = integration.toObject()
    await this.db.prepare(`
      INSERT INTO org_integrations (
        id, org_id, provider, name, credentials_encrypted, config_json,
        enabled, last_sync_at, created_at, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(org_id, provider) DO UPDATE SET
        name=excluded.name,
        credentials_encrypted=excluded.credentials_encrypted,
        config_json=excluded.config_json,
        enabled=excluded.enabled,
        last_sync_at=excluded.last_sync_at,
        updated_at=excluded.updated_at
    `).bind(
      o.id,
      o.org_id,
      o.provider,
      o.name,
      o.credentials_encrypted,
      o.config_json,
      o.enabled ? 1 : 0,
      o.last_sync_at,
      o.created_at,
      o.updated_at,
    ).run()
  }

  async findEnabledByProvider(provider: string): Promise<OrgIntegration[]> {
    const rows = (await this.db
      .prepare(`SELECT * FROM org_integrations WHERE provider = ? AND enabled = 1`)
      .bind(provider)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  private toEntity(row: any): OrgIntegration {
    return OrgIntegration.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      provider: row.provider,
      name: row.name ?? null,
      credentials_encrypted: row.credentials_encrypted ?? null,
      config_json: row.config_json ?? null,
      enabled: !!row.enabled,
      last_sync_at: row.last_sync_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
