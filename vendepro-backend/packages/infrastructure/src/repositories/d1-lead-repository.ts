import { Lead } from '@vendepro/core'
import type { LeadRepository, LeadFilters } from '@vendepro/core'

export class D1LeadRepository implements LeadRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Lead | null> {
    const row = await this.db
      .prepare(`SELECT l.*, u.full_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.id = ? AND l.org_id = ?`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: LeadFilters): Promise<Lead[]> {
    let query = `SELECT l.*, u.full_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.org_id = ?`
    const binds: unknown[] = [orgId]

    if (filters?.stage) { query += ' AND l.stage = ?'; binds.push(filters.stage) }
    if (filters?.agent_id) { query += ' AND l.assigned_to = ?'; binds.push(filters.agent_id) }
    if (filters?.search) {
      query += ' AND (l.full_name LIKE ? OR l.phone LIKE ?)'
      binds.push(`%${filters.search}%`, `%${filters.search}%`)
    }
    query += ' ORDER BY l.created_at DESC LIMIT 500'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(lead: Lead): Promise<void> {
    const o = lead.toObject()
    await this.db.prepare(`
      INSERT INTO leads (id, org_id, full_name, phone, email, source, source_detail, property_address,
        neighborhood, property_type, operation, stage, assigned_to, notes, estimated_value, budget,
        timing, personas_trabajo, mascotas, next_step, next_step_date, lost_reason, first_contact_at,
        created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        stage=excluded.stage, assigned_to=excluded.assigned_to, notes=excluded.notes,
        estimated_value=excluded.estimated_value, budget=excluded.budget, timing=excluded.timing,
        personas_trabajo=excluded.personas_trabajo, mascotas=excluded.mascotas,
        next_step=excluded.next_step, next_step_date=excluded.next_step_date,
        lost_reason=excluded.lost_reason, first_contact_at=excluded.first_contact_at,
        full_name=excluded.full_name, phone=excluded.phone, email=excluded.email,
        neighborhood=excluded.neighborhood, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.full_name, o.phone, o.email, o.source, o.source_detail,
      o.property_address, o.neighborhood, o.property_type, o.operation, o.stage,
      o.assigned_to, o.notes, o.estimated_value, o.budget, o.timing, o.personas_trabajo,
      o.mascotas, o.next_step, o.next_step_date, o.lost_reason, o.first_contact_at,
      o.created_at, o.updated_at
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM leads WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Lead {
    return Lead.create({
      id: row.id, org_id: row.org_id, full_name: row.full_name, phone: row.phone,
      email: row.email, source: row.source, source_detail: row.source_detail,
      property_address: row.property_address, neighborhood: row.neighborhood,
      property_type: row.property_type, operation: row.operation, stage: row.stage,
      assigned_to: row.assigned_to, notes: row.notes, estimated_value: row.estimated_value,
      budget: row.budget, timing: row.timing, personas_trabajo: row.personas_trabajo,
      mascotas: row.mascotas, next_step: row.next_step, next_step_date: row.next_step_date,
      lost_reason: row.lost_reason, first_contact_at: row.first_contact_at,
      created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
