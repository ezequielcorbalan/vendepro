import { Notification } from '@vendepro/core'
import type { NotificationRepository, NotificationKind } from '@vendepro/core'

export class D1NotificationRepository implements NotificationRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserId(userId: string, orgId: string, limit = 50): Promise<Notification[]> {
    const rows = (await this.db
      .prepare(
        `SELECT * FROM notifications
         WHERE user_id = ? AND org_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(userId, orgId, limit)
      .all()).results as any[]
    return rows.map((r) => this.toEntity(r))
  }

  async save(notification: Notification): Promise<void> {
    const o = notification.toObject()
    await this.db
      .prepare(
        `INSERT INTO notifications (id, org_id, user_id, kind, title, body, link_url, read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           org_id = excluded.org_id,
           user_id = excluded.user_id,
           kind = excluded.kind,
           title = excluded.title,
           body = excluded.body,
           link_url = excluded.link_url,
           read = excluded.read`,
      )
      .bind(
        o.id,
        o.org_id,
        o.user_id,
        o.kind,
        o.title,
        o.body,
        o.link_url,
        o.read ? 1 : 0,
        o.created_at,
      )
      .run()
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.db
      .prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run()
  }

  private toEntity(row: any): Notification {
    return Notification.create({
      id: row.id,
      org_id: row.org_id,
      user_id: row.user_id,
      kind: row.kind as NotificationKind,
      title: row.title,
      body: row.body ?? null,
      link_url: row.link_url ?? null,
      read: row.read === 1 || row.read === true,
      created_at: row.created_at,
    })
  }
}
