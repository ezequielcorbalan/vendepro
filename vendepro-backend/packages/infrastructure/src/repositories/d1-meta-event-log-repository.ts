import { MetaEventLog } from '@vendepro/core'
import type { MetaEventLogRepository } from '@vendepro/core'

export class D1MetaEventLogRepository implements MetaEventLogRepository {
  constructor(private readonly db: D1Database) {}

  async save(log: MetaEventLog): Promise<void> {
    const o = log.toObject()
    await this.db.prepare(`
      INSERT INTO meta_event_log (
        id, org_id, lead_id, event_id, event_name, status,
        response_code, response_body, attempts, last_error, sent_at, created_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status,
        response_code=excluded.response_code,
        response_body=excluded.response_body,
        attempts=excluded.attempts,
        last_error=excluded.last_error,
        sent_at=excluded.sent_at
    `).bind(
      o.id,
      o.org_id,
      o.lead_id,
      o.event_id,
      o.event_name,
      o.status,
      o.response_code,
      o.response_body,
      o.attempts,
      o.last_error,
      o.sent_at,
      o.created_at,
    ).run()
  }

  async findById(id: string, orgId: string): Promise<MetaEventLog | null> {
    const row = await this.db
      .prepare(`SELECT * FROM meta_event_log WHERE id = ? AND org_id = ? LIMIT 1`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByEventId(eventId: string, orgId: string): Promise<MetaEventLog | null> {
    const row = await this.db
      .prepare(`SELECT * FROM meta_event_log WHERE event_id = ? AND org_id = ? LIMIT 1`)
      .bind(eventId, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findFailedToRetry(orgId: string, maxAttempts: number, limit: number): Promise<MetaEventLog[]> {
    const rows = (await this.db
      .prepare(`SELECT * FROM meta_event_log WHERE org_id = ? AND status = 'failed' AND attempts < ? ORDER BY created_at ASC LIMIT ?`)
      .bind(orgId, maxAttempts, limit)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findRecentByOrg(orgId: string, limit: number): Promise<MetaEventLog[]> {
    const rows = (await this.db
      .prepare(`SELECT * FROM meta_event_log WHERE org_id = ? ORDER BY created_at DESC LIMIT ?`)
      .bind(orgId, limit)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  private toEntity(row: any): MetaEventLog {
    return MetaEventLog.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      lead_id: row.lead_id ?? null,
      event_id: row.event_id,
      event_name: row.event_name,
      status: row.status,
      response_code: row.response_code ?? null,
      response_body: row.response_body ?? null,
      attempts: row.attempts ?? 0,
      last_error: row.last_error ?? null,
      sent_at: row.sent_at ?? null,
      created_at: row.created_at,
    })
  }
}
