import { LandingTemplate } from '@vendepro/core'
import type { LandingTemplateRepository } from '@vendepro/core'
import type { LandingKind, Block } from '@vendepro/core'

export class D1LandingTemplateRepository implements LandingTemplateRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<LandingTemplate | null> {
    const row = await this.db.prepare(`SELECT * FROM landing_templates WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async listVisibleTo(orgId: string, filters?: { kind?: LandingKind; onlyActive?: boolean }): Promise<LandingTemplate[]> {
    let q = `SELECT * FROM landing_templates WHERE (org_id IS NULL OR org_id = ?)`
    const binds: unknown[] = [orgId]
    if (filters?.onlyActive) q += ` AND active = 1`
    if (filters?.kind) { q += ` AND kind = ?`; binds.push(filters.kind) }
    q += ` ORDER BY sort_order ASC, name ASC LIMIT 100`
    const rows = (await this.db.prepare(q).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(tpl: LandingTemplate): Promise<void> {
    const o = tpl.toObject()
    await this.db.prepare(`
      INSERT INTO landing_templates (id, org_id, name, kind, description, preview_image_url, blocks_json, active, sort_order, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, kind=excluded.kind, description=excluded.description,
        preview_image_url=excluded.preview_image_url, blocks_json=excluded.blocks_json,
        active=excluded.active, sort_order=excluded.sort_order, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.name, o.kind, o.description, o.preview_image_url, JSON.stringify(o.blocks),
      o.active ? 1 : 0, o.sort_order, o.created_at, o.updated_at,
    ).run()
  }

  private toEntity(row: any): LandingTemplate {
    const raw = JSON.parse(row.blocks_json)
    // Templates seed SQL may wrap blocks as {blocks:[...]} or store a bare array.
    const blocks: Block[] = Array.isArray(raw) ? raw : (raw.blocks ?? [])
    return LandingTemplate.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      kind: row.kind as LandingKind,
      description: row.description,
      preview_image_url: row.preview_image_url,
      blocks,
      active: !!row.active,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
