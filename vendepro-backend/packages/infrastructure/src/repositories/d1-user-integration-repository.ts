import { UserIntegration } from '@vendepro/core'
import type { UserIntegrationRepository } from '@vendepro/core'

export class D1UserIntegrationRepository implements UserIntegrationRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserAndProvider(userId: string, provider: string): Promise<UserIntegration | null> {
    const row = await this.db
      .prepare(`SELECT * FROM user_integrations WHERE user_id = ? AND provider = ?`)
      .bind(userId, provider)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(integration: UserIntegration): Promise<void> {
    const o = integration.toObject()
    await this.db.prepare(`
      INSERT INTO user_integrations (
        id, org_id, user_id, provider, credentials_encrypted, config_json,
        enabled, last_sync_at, created_at, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        credentials_encrypted=excluded.credentials_encrypted,
        config_json=excluded.config_json,
        enabled=excluded.enabled,
        last_sync_at=excluded.last_sync_at,
        updated_at=excluded.updated_at
    `).bind(
      o.id,
      o.org_id,
      o.user_id,
      o.provider,
      o.credentials_encrypted,
      o.config_json,
      o.enabled ? 1 : 0,
      o.last_sync_at,
      o.created_at,
      o.updated_at,
    ).run()
  }

  async delete(userId: string, provider: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM user_integrations WHERE user_id = ? AND provider = ?`)
      .bind(userId, provider)
      .run()
  }

  private toEntity(row: any): UserIntegration {
    return UserIntegration.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      user_id: row.user_id,
      provider: row.provider,
      credentials_encrypted: row.credentials_encrypted ?? null,
      config_json: row.config_json ?? null,
      enabled: !!row.enabled,
      last_sync_at: row.last_sync_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
