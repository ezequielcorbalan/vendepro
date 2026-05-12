import type { WhatsappConfig, WhatsappConfigRepository } from '@vendepro/core'

export class D1WhatsappConfigRepository implements WhatsappConfigRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrgId(orgId: string): Promise<WhatsappConfig | null> {
    const row = await this.db
      .prepare('SELECT * FROM whatsapp_config WHERE org_id = ?')
      .bind(orgId)
      .first() as any
    if (!row) return null
    return this.toConfig(row)
  }

  async save(config: WhatsappConfig): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO whatsapp_config (id, org_id, provider, api_token_encrypted, webhook_secret, welcome_template, bot_enabled, notify_agent_email, notify_admin_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(org_id) DO UPDATE SET
           provider = excluded.provider,
           api_token_encrypted = excluded.api_token_encrypted,
           webhook_secret = excluded.webhook_secret,
           welcome_template = excluded.welcome_template,
           bot_enabled = excluded.bot_enabled,
           notify_agent_email = excluded.notify_agent_email,
           notify_admin_email = excluded.notify_admin_email,
           updated_at = excluded.updated_at`,
      )
      .bind(
        config.id,
        config.org_id,
        config.provider,
        config.api_token_encrypted,
        config.webhook_secret,
        config.welcome_template,
        config.bot_enabled ? 1 : 0,
        config.notify_agent_email ? 1 : 0,
        config.notify_admin_email ? 1 : 0,
        config.created_at,
        config.updated_at,
      )
      .run()
  }

  private toConfig(row: any): WhatsappConfig {
    return {
      id: row.id,
      org_id: row.org_id,
      provider: row.provider,
      api_token_encrypted: row.api_token_encrypted ?? null,
      webhook_secret: row.webhook_secret ?? null,
      welcome_template: row.welcome_template,
      bot_enabled: row.bot_enabled === 1 || row.bot_enabled === true,
      notify_agent_email: row.notify_agent_email === 1 || row.notify_agent_email === true,
      notify_admin_email: row.notify_admin_email === 1 || row.notify_admin_email === true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }
}
