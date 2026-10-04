import { Conversation } from '@vendepro/core'
import type { ConversationRepository, ConversationFilters, ConversationChannel } from '@vendepro/core'

export class D1ConversationRepository implements ConversationRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Conversation | null> {
    const row = await this.db
      .prepare(`${SELECT_BASE} WHERE c.id = ? AND c.org_id = ?`)
      .bind(id, orgId)
      .first() as any
    return row ? toEntity(row) : null
  }

  async findByExternalId(orgId: string, channel: ConversationChannel, externalId: string): Promise<Conversation | null> {
    const row = await this.db
      .prepare(`${SELECT_BASE} WHERE c.org_id = ? AND c.channel = ? AND c.external_id = ?`)
      .bind(orgId, channel, externalId)
      .first() as any
    return row ? toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: ConversationFilters): Promise<Conversation[]> {
    let query = `${SELECT_BASE} WHERE c.org_id = ?`
    const binds: unknown[] = [orgId]

    if (filters?.status) { query += ' AND c.status = ?'; binds.push(filters.status) }
    if (filters?.channel) { query += ' AND c.channel = ?'; binds.push(filters.channel) }
    if (filters?.assignee_id) { query += ' AND c.assignee_id = ?'; binds.push(filters.assignee_id) }
    if (filters?.unassigned) { query += ' AND c.assignee_id IS NULL' }

    // La bandeja se lee por actividad: lo último que pasó, arriba.
    query += ' ORDER BY c.last_activity_at DESC LIMIT ?'
    binds.push(Math.min(filters?.limit ?? 100, 200))

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(toEntity)
  }

  async save(conversation: Conversation): Promise<void> {
    const o = conversation.toObject()
    await this.db.prepare(`
      INSERT INTO conversations (id, org_id, channel, contact_id, lead_id, external_id, status,
        assignee_id, labels, last_activity_at, window_expires_at, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        contact_id=excluded.contact_id, lead_id=excluded.lead_id, status=excluded.status,
        assignee_id=excluded.assignee_id, labels=excluded.labels,
        last_activity_at=excluded.last_activity_at, window_expires_at=excluded.window_expires_at,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.channel, o.contact_id, o.lead_id, o.external_id, o.status,
      o.assignee_id, JSON.stringify(o.labels), o.last_activity_at, o.window_expires_at,
      o.created_at, o.updated_at,
    ).run()
  }
}

// El nombre del contacto y del agente se traen en el mismo SELECT: la bandeja
// los muestra en cada fila y sin esto serían dos queries por conversación.
const SELECT_BASE = `
  SELECT c.*, ct.full_name AS contact_name, u.full_name AS assignee_name,
    (SELECT m.content FROM messages m WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC LIMIT 1) AS last_message
  FROM conversations c
  LEFT JOIN contacts ct ON ct.id = c.contact_id
  LEFT JOIN users u ON u.id = c.assignee_id`

function toEntity(row: any): Conversation {
  return Conversation.create({
    id: row.id,
    org_id: row.org_id,
    channel: row.channel,
    contact_id: row.contact_id ?? null,
    lead_id: row.lead_id ?? null,
    external_id: row.external_id,
    status: row.status,
    assignee_id: row.assignee_id ?? null,
    labels: parseLabels(row.labels),
    last_activity_at: row.last_activity_at ?? null,
    window_expires_at: row.window_expires_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    contact_name: row.contact_name ?? null,
    assignee_name: row.assignee_name ?? null,
    last_message: row.last_message ?? null,
  })
}

/** Una fila con el JSON roto no puede tumbar la bandeja entera. */
function parseLabels(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((l): l is string => typeof l === 'string') : []
  } catch {
    return []
  }
}
