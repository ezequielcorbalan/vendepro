import type { EmailCampaignSendRepository, CampaignSendRow } from '@vendepro/core'

export class D1EmailCampaignSendRepository implements EmailCampaignSendRepository {
  constructor(private readonly db: D1Database) {}

  async insertMany(rows: Array<Pick<CampaignSendRow, 'id' | 'org_id' | 'campaign_id' | 'email' | 'name' | 'contact_id' | 'lead_id'>>): Promise<void> {
    // D1 batch: una statement por fila, atómico por lote. ON CONFLICT
    // ignora duplicados (re-encolar no duplica destinatarios).
    const stmt = this.db.prepare(`
      INSERT INTO email_campaign_sends (id, org_id, campaign_id, email, name, contact_id, lead_id)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(campaign_id, email) DO NOTHING
    `)
    // Lotes de 50 para no exceder límites de D1 batch.
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50)
      await this.db.batch(chunk.map(r =>
        stmt.bind(r.id, r.org_id, r.campaign_id, r.email, r.name, r.contact_id, r.lead_id),
      ))
    }
  }

  async listPending(campaignId: string, limit: number, maxAttempts: number): Promise<CampaignSendRow[]> {
    const { results } = await this.db.prepare(`
      SELECT * FROM email_campaign_sends
      WHERE campaign_id = ? AND status IN ('pending','failed') AND attempts < ?
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(campaignId, maxAttempts, limit).all()
    return results as unknown as CampaignSendRow[]
  }

  async countPending(campaignId: string, maxAttempts: number): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(*) as n FROM email_campaign_sends
      WHERE campaign_id = ? AND status IN ('pending','failed') AND attempts < ?
    `).bind(campaignId, maxAttempts).first() as any
    return row?.n ?? 0
  }

  async markSent(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    await this.db.prepare(`
      UPDATE email_campaign_sends
      SET status = 'sent', sent_at = datetime('now'), error = NULL
      WHERE id IN (${placeholders})
    `).bind(...ids).run()
  }

  async markFailed(ids: string[], error: string): Promise<void> {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    await this.db.prepare(`
      UPDATE email_campaign_sends
      SET status = 'failed', attempts = attempts + 1, error = ?
      WHERE id IN (${placeholders})
    `).bind(error.slice(0, 500), ...ids).run()
  }

  async listByCampaign(campaignId: string, orgId: string, limit = 200): Promise<CampaignSendRow[]> {
    const { results } = await this.db.prepare(`
      SELECT * FROM email_campaign_sends
      WHERE campaign_id = ? AND org_id = ?
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(campaignId, orgId, limit).all()
    return results as unknown as CampaignSendRow[]
  }

  async deleteByCampaign(campaignId: string, orgId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM email_campaign_sends WHERE campaign_id = ? AND org_id = ?`)
      .bind(campaignId, orgId)
      .run()
  }
}
