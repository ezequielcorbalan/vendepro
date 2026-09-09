import type { StageHistoryRepository, StageHistoryEntry, StageHistoryEntityType } from '@vendepro/core'

export class D1StageHistoryRepository implements StageHistoryRepository {
  constructor(private readonly db: D1Database) {}

  async findByEntity(entityType: StageHistoryEntityType, entityId: string, orgId: string): Promise<StageHistoryEntry[]> {
    const rows = (await this.db
      // changed_at has second precision, and rapid sequential writes can land
      // in the same second. Without a tiebreaker SQLite returns the rows in an
      // undefined order, so the caller sees the wrong "current stage". rowid
      // is the implicit auto-increment column on a regular SQLite table, so
      // ORDER BY rowid DESC matches insertion order exactly.
      .prepare(`SELECT sh.*, u.full_name as changed_by_name FROM stage_history sh LEFT JOIN users u ON sh.changed_by = u.id WHERE sh.org_id = ? AND sh.entity_id = ? AND sh.entity_type = ? ORDER BY sh.changed_at DESC, sh.rowid DESC`)
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

  async findTransitionsForLeads(
    orgId: string,
    leadIds: string[],
  ): Promise<Array<{ entity_id: string; to_stage: string; changed_at: string }>> {
    if (leadIds.length === 0) return []

    // D1 limita los parámetros por statement, así que se pide de a tandas.
    // Mismo tamaño que usa D1TagRepository para lo mismo.
    const CHUNK = 50
    const out: Array<{ entity_id: string; to_stage: string; changed_at: string }> = []
    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const chunk = leadIds.slice(i, i + CHUNK)
      const placeholders = chunk.map(() => '?').join(',')
      const rows = (await this.db.prepare(`
        SELECT entity_id, to_stage, changed_at
        FROM stage_history
        WHERE org_id = ? AND entity_type = 'lead' AND entity_id IN (${placeholders})
      `).bind(orgId, ...chunk).all()).results as any[]
      for (const r of rows) {
        out.push({ entity_id: r.entity_id, to_stage: r.to_stage, changed_at: r.changed_at })
      }
    }
    return out
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
