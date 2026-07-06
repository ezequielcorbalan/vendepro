import { EmailSettings } from '@vendepro/core'
import type { EmailSettingsRepository } from '@vendepro/core'

export class D1EmailSettingsRepository implements EmailSettingsRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string): Promise<EmailSettings | null> {
    const row = await this.db
      .prepare(`SELECT * FROM email_settings WHERE org_id = ?`)
      .bind(orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(settings: EmailSettings): Promise<void> {
    const o = settings.toObject()
    await this.db.prepare(`
      INSERT INTO email_settings (
        org_id, from_name, from_email, reply_to, enabled,
        resend_domain_id, domain_status, created_at, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(org_id) DO UPDATE SET
        from_name=excluded.from_name,
        from_email=excluded.from_email,
        reply_to=excluded.reply_to,
        enabled=excluded.enabled,
        resend_domain_id=excluded.resend_domain_id,
        domain_status=excluded.domain_status,
        updated_at=excluded.updated_at
    `).bind(
      o.org_id,
      o.from_name,
      o.from_email,
      o.reply_to,
      o.enabled ? 1 : 0,
      o.resend_domain_id,
      o.domain_status,
      o.created_at,
      o.updated_at,
    ).run()
  }

  private toEntity(row: any): EmailSettings {
    return EmailSettings.fromPersistence({
      org_id: row.org_id,
      from_name: row.from_name ?? null,
      from_email: row.from_email ?? null,
      reply_to: row.reply_to ?? null,
      enabled: !!row.enabled,
      resend_domain_id: row.resend_domain_id ?? null,
      domain_status: row.domain_status ?? 'unverified',
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
