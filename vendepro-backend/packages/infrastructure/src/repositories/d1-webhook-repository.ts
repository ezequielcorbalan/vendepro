import { Webhook } from '@vendepro/core'
import type { WebhookRepository } from '@vendepro/core'

export class D1WebhookRepository implements WebhookRepository {
  constructor(private readonly db: D1Database) {}

  async save(webhook: Webhook): Promise<void> {
    const o = webhook.toObject()
    await this.db.prepare(`
      INSERT INTO webhooks (id, org_id, name, url, secret, events, is_active,
        last_triggered_at, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, url=excluded.url, events=excluded.events,
        is_active=excluded.is_active, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.name, o.url, o.secret, o.events.join(','),
      o.is_active ? 1 : 0, o.last_triggered_at, o.created_at, o.updated_at,
    ).run()
  }

  async findById(id: string, orgId: string): Promise<Webhook | null> {
    const row = await this.db
      .prepare('SELECT * FROM webhooks WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string): Promise<Webhook[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM webhooks WHERE org_id = ? ORDER BY created_at DESC')
      .bind(orgId)
      .all()).results as any[]
    return rows.map((r) => this.toEntity(r))
  }

  async findActiveByEvent(orgId: string, event: string): Promise<Webhook[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM webhooks WHERE org_id = ? AND is_active = 1')
      .bind(orgId)
      .all()).results as any[]
    // El filtro por evento se hace acá (CSV en la columna events); una org
    // tiene pocos webhooks, no justifica LIKE en SQL.
    return rows.map((r) => this.toEntity(r)).filter((w) => w.listensTo(event))
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM webhooks WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .run()
    await this.db
      .prepare('DELETE FROM webhook_deliveries WHERE webhook_id = ? AND org_id = ?')
      .bind(id, orgId)
      .run()
  }

  async touchLastTriggered(id: string): Promise<void> {
    await this.db
      .prepare(`UPDATE webhooks SET last_triggered_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run()
  }

  private toEntity(row: any): Webhook {
    return Webhook.create({
      id: row.id,
      org_id: row.org_id,
      name: row.name ?? null,
      url: row.url,
      secret: row.secret,
      events: typeof row.events === 'string' && row.events.length > 0 ? row.events.split(',') : [],
      is_active: row.is_active === 1 || row.is_active === true,
      last_triggered_at: row.last_triggered_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
