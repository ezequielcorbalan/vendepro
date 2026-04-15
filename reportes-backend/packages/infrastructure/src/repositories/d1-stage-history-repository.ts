import type { StageHistoryRepository, StageHistoryEntry } from '@reportes/core'

export class D1StageHistoryRepository implements StageHistoryRepository {
  constructor(private readonly db: D1Database) {}

  async findByEntity(entityType: 'lead' | 'reservation', entityId: string, orgId: string): Promise<StageHistoryEntry[]> {
    const rows = (await this.db
      .prepare(`SELECT sh.*, u.full_name as changed_by_name FROM stage_history sh LEFT JOIN users u ON sh.changed_by = u.id WHERE sh.entity_type = ? AND sh.entity_id = ? AND sh.org_id = ? ORDER BY sh.changed_at DESC`)
      .bind(entityType, entityId, orgId)
      .all()).results as any[]

    return rows.map(r => ({
      id: r.id, org_id: r.org_id, entity_type: r.entity_type,
      entity_id: r.entity_id, from_stage: r.from_stage, to_stage: r.to_stage,
      changed_by: r.changed_by, changed_at: r.changed_at, notes: r.notes,
    }))
  }

  async log(entry: Omit<StageHistoryEntry, 'id' | 'changed_at'>): Promise<void> {
    const id = crypto.randomUUID().replace(/-/g, '')
    await this.db.prepare(`
      INSERT INTO stage_history (id, org_id, entity_type, entity_id, from_stage, to_stage, changed_by, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(id, entry.org_id, entry.entity_type, entry.entity_id, entry.from_stage, entry.to_stage, entry.changed_by, entry.notes).run()
  }
}
