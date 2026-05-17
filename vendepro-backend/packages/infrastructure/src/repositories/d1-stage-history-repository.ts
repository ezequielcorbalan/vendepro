import type { StageHistoryRepository, StageHistoryEntry, StageHistoryEntityType } from '@vendepro/core'

export class D1StageHistoryRepository implements StageHistoryRepository {
  constructor(private readonly db: D1Database) {}

  async findByEntity(entityType: StageHistoryEntityType, entityId: string, orgId: string): Promise<StageHistoryEntry[]> {
    const rows = (await this.db
      .prepare(`SELECT sh.*, u.full_name as changed_by_name FROM stage_history sh LEFT JOIN users u ON sh.changed_by = u.id WHERE sh.org_id = ? AND sh.entity_id = ? AND sh.entity_type = ? ORDER BY sh.changed_at DESC`)
      .bind(orgId, entityId, entityType)
      .all()).results as any[]

    return rows.map(r => ({
      id: r.id, org_id: r.org_id, entity_type: r.entity_type,
      entity_id: r.entity_id, from_stage: r.from_stage, to_stage: r.to_stage,
      changed_by: r.changed_by, changed_at: r.changed_at, notes: r.notes,
      triggered_by: r.triggered_by ?? 'user',
      changed_by_name: r.changed_by_name ?? null,
    }))
  }

  async log(entry: Omit<StageHistoryEntry, 'id' | 'changed_at'>): Promise<void> {
    const id = crypto.randomUUID().replace(/-/g, '')
    const triggeredBy = entry.triggered_by ?? 'user'
    await this.db.prepare(`
      INSERT INTO stage_history (id, org_id, entity_type, entity_id, from_stage, to_stage, changed_by, notes, triggered_by)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(id, entry.org_id, entry.entity_type, entry.entity_id, entry.from_stage, entry.to_stage, entry.changed_by, entry.notes, triggeredBy).run()
  }
}
