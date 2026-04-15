import { CalendarEvent } from '@vendepro/core'
import type { CalendarRepository, CalendarFilters } from '@vendepro/core'

export class D1CalendarRepository implements CalendarRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<CalendarEvent | null> {
    const row = await this.db
      .prepare(`SELECT e.*, u.full_name as agent_name FROM calendar_events e LEFT JOIN users u ON e.agent_id = u.id WHERE e.id = ? AND e.org_id = ?`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: CalendarFilters): Promise<CalendarEvent[]> {
    let query = `SELECT e.*, u.full_name as agent_name FROM calendar_events e LEFT JOIN users u ON e.agent_id = u.id WHERE e.org_id = ?`
    const binds: unknown[] = [orgId]

    if (filters?.agent_id) { query += ' AND e.agent_id = ?'; binds.push(filters.agent_id) }
    if (filters?.event_type) { query += ' AND e.event_type = ?'; binds.push(filters.event_type) }
    if (filters?.start) { query += ' AND e.start_at >= ?'; binds.push(filters.start) }
    if (filters?.end) { query += ' AND e.end_at <= ?'; binds.push(filters.end) }
    query += ' ORDER BY e.start_at ASC LIMIT 500'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(event: CalendarEvent): Promise<void> {
    const o = event.toObject()
    await this.db.prepare(`
      INSERT INTO calendar_events (id, org_id, agent_id, title, event_type, start_at, end_at, all_day,
        description, lead_id, contact_id, property_id, appraisal_id, reservation_id, color, completed,
        created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, event_type=excluded.event_type, start_at=excluded.start_at,
        end_at=excluded.end_at, all_day=excluded.all_day, description=excluded.description,
        completed=excluded.completed, color=excluded.color, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.agent_id, o.title, o.event_type, o.start_at, o.end_at, o.all_day,
      o.description, o.lead_id, o.contact_id, o.property_id, o.appraisal_id, o.reservation_id,
      o.color, o.completed, o.created_at, o.updated_at
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM calendar_events WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): CalendarEvent {
    return CalendarEvent.create({
      id: row.id, org_id: row.org_id, agent_id: row.agent_id, title: row.title,
      event_type: row.event_type, start_at: row.start_at, end_at: row.end_at,
      all_day: row.all_day ?? 0, description: row.description, lead_id: row.lead_id,
      contact_id: row.contact_id, property_id: row.property_id, appraisal_id: row.appraisal_id,
      reservation_id: row.reservation_id, color: row.color, completed: row.completed ?? 0,
      created_at: row.created_at, updated_at: row.updated_at, agent_name: row.agent_name,
    })
  }
}
