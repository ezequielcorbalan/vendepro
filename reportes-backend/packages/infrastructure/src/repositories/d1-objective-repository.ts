import { Objective } from '@reportes/core'
import type { ObjectiveRepository, ObjectiveFilters } from '@reportes/core'

export class D1ObjectiveRepository implements ObjectiveRepository {
  constructor(private readonly db: D1Database) {}

  async findByAgent(agentId: string, orgId: string): Promise<Objective[]> {
    const rows = (await this.db
      .prepare(`SELECT o.*, u.full_name as agent_name FROM agent_objectives o LEFT JOIN users u ON o.agent_id = u.id WHERE o.agent_id = ? AND o.org_id = ? AND o.period_end >= date('now') ORDER BY o.period_start DESC`)
      .bind(agentId, orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findByOrg(orgId: string, filters?: ObjectiveFilters): Promise<Objective[]> {
    let query = `SELECT o.*, u.full_name as agent_name FROM agent_objectives o LEFT JOIN users u ON o.agent_id = u.id WHERE o.org_id = ? AND o.period_end >= date('now')`
    const binds: unknown[] = [orgId]

    if (filters?.agent_id) { query += ' AND o.agent_id = ?'; binds.push(filters.agent_id) }
    if (filters?.period_type) { query += ' AND o.period_type = ?'; binds.push(filters.period_type) }
    query += ' ORDER BY o.period_start DESC'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(objective: Objective): Promise<void> {
    const o = objective.toObject()
    await this.db.prepare(`
      INSERT INTO agent_objectives (id, org_id, agent_id, period_type, period_start, period_end, metric, target, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET target=excluded.target, updated_at=excluded.updated_at
    `).bind(o.id, o.org_id, o.agent_id, o.period_type, o.period_start, o.period_end, o.metric, o.target, o.created_at, o.updated_at).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM agent_objectives WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Objective {
    return Objective.create({
      id: row.id, org_id: row.org_id, agent_id: row.agent_id, period_type: row.period_type,
      period_start: row.period_start, period_end: row.period_end, metric: row.metric,
      target: row.target, created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
