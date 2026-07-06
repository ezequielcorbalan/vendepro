import { EmailSuppression } from '@vendepro/core'
import type { EmailSuppressionRepository } from '@vendepro/core'

export class D1EmailSuppressionRepository implements EmailSuppressionRepository {
  constructor(private readonly db: D1Database) {}

  async add(suppression: EmailSuppression): Promise<void> {
    const o = suppression.toObject()
    // Idempotente: si (org_id, email) ya existe, no pisa el registro
    // original (conserva la primera razón/fecha de baja).
    await this.db.prepare(`
      INSERT INTO email_suppressions (id, org_id, email, reason, source, created_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(org_id, email) DO NOTHING
    `).bind(o.id, o.org_id, o.email, o.reason, o.source, o.created_at).run()
  }

  async findByEmail(orgId: string, email: string): Promise<EmailSuppression | null> {
    const row = await this.db
      .prepare(`SELECT * FROM email_suppressions WHERE org_id = ? AND email = ?`)
      .bind(orgId, email.trim().toLowerCase())
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async listByOrg(orgId: string, limit = 100): Promise<EmailSuppression[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM email_suppressions WHERE org_id = ? ORDER BY created_at DESC LIMIT ?`)
      .bind(orgId, limit)
      .all()
    return (results as any[]).map(r => this.toEntity(r))
  }

  async remove(orgId: string, email: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM email_suppressions WHERE org_id = ? AND email = ?`)
      .bind(orgId, email.trim().toLowerCase())
      .run()
  }

  private toEntity(row: any): EmailSuppression {
    return EmailSuppression.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      email: row.email,
      reason: row.reason ?? 'unsubscribe',
      source: row.source ?? null,
      created_at: row.created_at,
    })
  }
}
