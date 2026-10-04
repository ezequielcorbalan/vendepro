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
//
// El lead se resuelve al leer y no se congela al crear la conversación: una
// charla puede empezar antes de que exista el lead, o el contacto puede tener
// uno nuevo después. Si la conversación tiene `lead_id` explícito manda ése;
// si no, el lead vivo más reciente del contacto, y recién después uno cerrado
// —desde la conversación se quiere llegar al trabajo en curso.
const LEAD_RESUELTO = `
  COALESCE(c.lead_id, (
    SELECT l.id FROM leads l
    WHERE l.contact_id = c.contact_id AND l.org_id = c.org_id
    ORDER BY CASE WHEN l.stage IN ('perdido','invalido','finalizado','cerrado') THEN 1 ELSE 0 END,
             l.created_at DESC
    LIMIT 1))`

const SELECT_BASE = `
  SELECT c.*, ct.full_name AS contact_name, u.full_name AS assignee_name,
    (SELECT m.content FROM messages m WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC LIMIT 1) AS last_message,
    ${LEAD_RESUELTO} AS resolved_lead_id,
    (SELECT l.full_name FROM leads l WHERE l.id = ${LEAD_RESUELTO}) AS lead_name,
    (SELECT l.stage FROM leads l WHERE l.id = ${LEAD_RESUELTO}) AS lead_stage,
    (SELECT COALESCE(l.pipeline, 'vendedor') FROM leads l WHERE l.id = ${LEAD_RESUELTO}) AS lead_pipeline
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
    lead: row.resolved_lead_id
      ? {
          id: row.resolved_lead_id,
          full_name: row.lead_name ?? null,
          stage: row.lead_stage ?? null,
          pipeline: row.lead_pipeline ?? 'vendedor',
        }
      : null,
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
