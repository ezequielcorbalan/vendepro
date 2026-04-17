import { Activity } from '@vendepro/core'
import type { ActivityRepository, ActivityFilters } from '@vendepro/core'

export class D1ActivityRepository implements ActivityRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string, filters?: ActivityFilters): Promise<Activity[]> {
    let query = `SELECT a.*, u.full_name as agent_name FROM activities a LEFT JOIN users u ON a.agent_id = u.id WHERE a.org_id = ?`
    const binds: unknown[] = [orgId]

    if (filters?.agent_id) { query += ' AND a.agent_id = ?'; binds.push(filters.agent_id) }
    if (filters?.lead_id) { query += ' AND a.lead_id = ?'; binds.push(filters.lead_id) }
    if (filters?.contact_id) { query += ' AND a.contact_id = ?'; binds.push(filters.contact_id) }
    if (filters?.property_id) { query += ' AND a.property_id = ?'; binds.push(filters.property_id) }
    query += ' ORDER BY a.created_at DESC LIMIT 200'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findById(id: string, orgId: string): Promise<Activity | null> {
    const row = await this.db
      .prepare('SELECT * FROM activities WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(activity: Activity): Promise<void> {
    const o = activity.toObject()
    await this.db.prepare(`
      INSERT INTO activities (id, org_id, agent_id, activity_type, description, lead_id, contact_id,
        property_id, appraisal_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        description=excluded.description, updated_at=datetime('now')
    `).bind(o.id, o.org_id, o.agent_id, o.activity_type, o.description, o.lead_id, o.contact_id, o.property_id, o.appraisal_id, o.created_at).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM activities WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Activity {
    return Activity.create({
      id: row.id, org_id: row.org_id, agent_id: row.agent_id, activity_type: row.activity_type,
      description: row.description ?? null, lead_id: row.lead_id ?? null,
      contact_id: row.contact_id ?? null, property_id: row.property_id ?? null,
      appraisal_id: row.appraisal_id ?? null, created_at: row.created_at,
    })
  }
}
