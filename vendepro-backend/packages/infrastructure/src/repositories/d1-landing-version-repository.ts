import { LandingVersion, type VersionLabel } from '@vendepro/core'
import type { LandingVersionRepository, Block } from '@vendepro/core'

export class D1LandingVersionRepository implements LandingVersionRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<LandingVersion | null> {
    const row = await this.db.prepare(`SELECT * FROM landing_versions WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async listByLanding(landingId: string, limit = 50): Promise<LandingVersion[]> {
    const rows = (await this.db.prepare(`SELECT * FROM landing_versions WHERE landing_id = ? ORDER BY version_number DESC LIMIT ?`)
      .bind(landingId, limit).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(v: LandingVersion): Promise<void> {
    const o = v.toObject()
    await this.db.prepare(`
      INSERT INTO landing_versions (id, landing_id, version_number, blocks_json, label, created_by, created_at)
      VALUES (?,?,?,?,?,?,?)
    `).bind(o.id, o.landing_id, o.version_number, JSON.stringify(o.blocks), o.label, o.created_by, o.created_at).run()
  }

  async nextVersionNumber(landingId: string): Promise<number> {
    const row = await this.db.prepare(`SELECT COALESCE(MAX(version_number), 0) AS m FROM landing_versions WHERE landing_id = ?`).bind(landingId).first() as any
    return (row?.m ?? 0) + 1
  }

  async pruneNonPublish(landingId: string, keepLatest: number): Promise<number> {
    const res = await this.db.prepare(`
      DELETE FROM landing_versions
      WHERE landing_id = ?
        AND label != 'publish'
        AND id NOT IN (
          SELECT id FROM landing_versions
          WHERE landing_id = ? AND label != 'publish'
          ORDER BY version_number DESC LIMIT ?
        )
    `).bind(landingId, landingId, keepLatest).run()
    return (res.meta as any)?.changes ?? 0
  }

  private toEntity(row: any): LandingVersion {
    return LandingVersion.fromPersistence({
      id: row.id,
      landing_id: row.landing_id,
      version_number: row.version_number,
      blocks: JSON.parse(row.blocks_json) as Block[],
      label: row.label as VersionLabel,
      created_by: row.created_by,
      created_at: row.created_at,
    })
  }
}
