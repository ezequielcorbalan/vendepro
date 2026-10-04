import { Message } from '@vendepro/core'
import type { MessageRepository } from '@vendepro/core'

export class D1MessageRepository implements MessageRepository {
  constructor(private readonly db: D1Database) {}

  async findByConversation(conversationId: string, orgId: string, limit = 200): Promise<Message[]> {
    const rows = (await this.db
      .prepare(`
        SELECT m.*, u.full_name AS sender_name
        FROM messages m
        LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = ? AND m.org_id = ?
        ORDER BY m.created_at ASC
        LIMIT ?`)
      .bind(conversationId, orgId, Math.min(limit, 500))
      .all()).results as any[]
    return rows.map(toEntity)
  }

  async findByExternalId(orgId: string, externalId: string): Promise<Message | null> {
    const row = await this.db
      .prepare('SELECT * FROM messages WHERE org_id = ? AND external_id = ?')
      .bind(orgId, externalId)
      .first() as any
    return row ? toEntity(row) : null
  }

  async save(message: Message): Promise<void> {
    const o = message.toObject()
    await this.db.prepare(`
      INSERT INTO messages (id, org_id, conversation_id, direction, sender_type, sender_id,
        content, attachments, external_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO NOTHING
    `).bind(
      o.id, o.org_id, o.conversation_id, o.direction, o.sender_type, o.sender_id,
      o.content, JSON.stringify(o.attachments), o.external_id, o.created_at,
    ).run()
  }
}

function toEntity(row: any): Message {
  return Message.create({
    id: row.id,
    org_id: row.org_id,
    conversation_id: row.conversation_id,
    direction: row.direction,
    sender_type: row.sender_type,
    sender_id: row.sender_id ?? null,
    content: row.content ?? null,
    attachments: parseAttachments(row.attachments),
    external_id: row.external_id ?? null,
    created_at: row.created_at,
    sender_name: row.sender_name ?? null,
  })
}

function parseAttachments(raw: unknown): any[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
