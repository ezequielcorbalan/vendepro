import type { WebhookDeliveryRepository, WebhookDeliveryLog } from '@vendepro/core'

export class D1WebhookDeliveryRepository implements WebhookDeliveryRepository {
  constructor(private readonly db: D1Database) {}

  async log(entry: WebhookDeliveryLog): Promise<void> {
    await this.db.prepare(`
      INSERT INTO webhook_deliveries (id, org_id, webhook_id, event, status, http_status, attempts, error, created_at)
      VALUES (?,?,?,?,?,?,?,?, datetime('now'))
    `).bind(
      entry.id, entry.org_id, entry.webhook_id, entry.event, entry.status,
      entry.http_status, entry.attempts, entry.error,
    ).run()
  }

  async findByWebhook(webhookId: string, orgId: string, limit = 20): Promise<WebhookDeliveryLog[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM webhook_deliveries WHERE webhook_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(webhookId, orgId, limit)
      .all()).results as any[]
    return rows.map((r) => ({
      id: r.id,
      org_id: r.org_id,
      webhook_id: r.webhook_id,
      event: r.event,
      status: r.status,
      http_status: r.http_status ?? null,
      attempts: r.attempts ?? 1,
      error: r.error ?? null,
      created_at: r.created_at,
    }))
  }
}
