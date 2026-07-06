import { EmailCampaign } from '@vendepro/core'
import type { EmailCampaignRepository, EmailCampaignStatus } from '@vendepro/core'

export class D1EmailCampaignRepository implements EmailCampaignRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<EmailCampaign | null> {
    const row = await this.db
      .prepare(`SELECT * FROM email_campaigns WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async listByOrg(orgId: string, limit = 50): Promise<EmailCampaign[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM email_campaigns WHERE org_id = ? ORDER BY created_at DESC LIMIT ?`)
      .bind(orgId, limit)
      .all()
    return (results as any[]).map(r => this.toEntity(r))
  }

  async listByStatus(status: EmailCampaignStatus, limit = 20): Promise<EmailCampaign[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM email_campaigns WHERE status = ? ORDER BY created_at ASC LIMIT ?`)
      .bind(status, limit)
      .all()
    return (results as any[]).map(r => this.toEntity(r))
  }

  async save(campaign: EmailCampaign): Promise<void> {
    const o = campaign.toObject()
    await this.db.prepare(`
      INSERT INTO email_campaigns (
        id, org_id, name, subject, preheader, html, text, segment_json,
        status, scheduled_at, total_recipients, sent_count, failed_count,
        created_by, sent_at, created_at, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        subject=excluded.subject,
        preheader=excluded.preheader,
        html=excluded.html,
        text=excluded.text,
        segment_json=excluded.segment_json,
        status=excluded.status,
        scheduled_at=excluded.scheduled_at,
        total_recipients=excluded.total_recipients,
        sent_count=excluded.sent_count,
        failed_count=excluded.failed_count,
        sent_at=excluded.sent_at,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.name, o.subject, o.preheader, o.html, o.text, o.segment_json,
      o.status, o.scheduled_at, o.total_recipients, o.sent_count, o.failed_count,
      o.created_by, o.sent_at, o.created_at, o.updated_at,
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM email_campaigns WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .run()
  }

  private toEntity(row: any): EmailCampaign {
    return EmailCampaign.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      subject: row.subject ?? null,
      preheader: row.preheader ?? null,
      html: row.html ?? null,
      text: row.text ?? null,
      segment_json: row.segment_json ?? null,
      status: row.status,
      scheduled_at: row.scheduled_at ?? null,
      total_recipients: row.total_recipients ?? 0,
      sent_count: row.sent_count ?? 0,
      failed_count: row.failed_count ?? 0,
      created_by: row.created_by ?? null,
      sent_at: row.sent_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
