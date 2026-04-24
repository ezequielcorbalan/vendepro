import { StageEventMapping } from '@vendepro/core'
import type { StageEventMappingRepository } from '@vendepro/core'

export class D1StageEventMappingRepository implements StageEventMappingRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string): Promise<StageEventMapping[]> {
    const rows = (await this.db
      .prepare(`SELECT * FROM stage_event_mappings WHERE org_id = ? ORDER BY stage_key ASC`)
      .bind(orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findByOrgAndStage(orgId: string, stageKey: string): Promise<StageEventMapping | null> {
    const row = await this.db
      .prepare(`SELECT * FROM stage_event_mappings WHERE org_id = ? AND stage_key = ? LIMIT 1`)
      .bind(orgId, stageKey)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(mapping: StageEventMapping): Promise<void> {
    const o = mapping.toObject()
    // Upsert por (org_id, stage_key) gracias al UNIQUE INDEX
    await this.db.prepare(`
      INSERT INTO stage_event_mappings (id, org_id, stage_key, meta_event_name, ga4_event_name, enabled, created_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(org_id, stage_key) DO UPDATE SET
        meta_event_name=excluded.meta_event_name,
        ga4_event_name=excluded.ga4_event_name,
        enabled=excluded.enabled
    `).bind(
      o.id,
      o.org_id,
      o.stage_key,
      o.meta_event_name,
      o.ga4_event_name,
      o.enabled ? 1 : 0,
      o.created_at,
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM stage_event_mappings WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .run()
  }

  private toEntity(row: any): StageEventMapping {
    return StageEventMapping.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      stage_key: row.stage_key,
      meta_event_name: row.meta_event_name,
      ga4_event_name: row.ga4_event_name ?? null,
      enabled: !!row.enabled,
      created_at: row.created_at,
    })
  }
}
