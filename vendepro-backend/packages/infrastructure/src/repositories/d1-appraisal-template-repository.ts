import { AppraisalTemplate } from '@vendepro/core'
import type { AppraisalTemplateRepository, AppraisalTemplateKind, AppraisalTemplateBlock } from '@vendepro/core'

export class D1AppraisalTemplateRepository implements AppraisalTemplateRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<AppraisalTemplate | null> {
    const row = await this.db.prepare(`SELECT * FROM appraisal_templates WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async listVisibleTo(orgId: string, filters?: { kind?: AppraisalTemplateKind; onlyActive?: boolean }): Promise<AppraisalTemplate[]> {
    let q = `SELECT * FROM appraisal_templates WHERE (org_id IS NULL OR org_id = ?)`
    const binds: unknown[] = [orgId]
    if (filters?.onlyActive) q += ` AND active = 1`
    if (filters?.kind) { q += ` AND kind = ?`; binds.push(filters.kind) }
    q += ` ORDER BY sort_order ASC, name ASC LIMIT 100`
    const rows = (await this.db.prepare(q).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(tpl: AppraisalTemplate): Promise<void> {
    const o = tpl.toObject()
    await this.db.prepare(`
      INSERT INTO appraisal_templates (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        kind=excluded.kind, name=excluded.name, description=excluded.description,
        preview_image_url=excluded.preview_image_url, blocks_json=excluded.blocks_json,
        is_system=excluded.is_system, parent_template_id=excluded.parent_template_id,
        active=excluded.active, sort_order=excluded.sort_order, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.kind, o.name, o.description, o.preview_image_url,
      JSON.stringify(o.blocks), o.is_system ? 1 : 0, o.parent_template_id,
      o.active ? 1 : 0, o.sort_order, o.created_at, o.updated_at,
    ).run()
  }

  async countUsingTemplate(templateId: string): Promise<number> {
    try {
      const r = await this.db.prepare(`SELECT COUNT(*) as n FROM appraisals WHERE template_id = ?`).bind(templateId).first() as any
      return Number(r?.n ?? 0)
    } catch { return 0 }
  }

  private toEntity(row: any): AppraisalTemplate {
    const raw = JSON.parse(row.blocks_json ?? '[]')
    const blocks = (Array.isArray(raw) ? raw : (raw.blocks ?? [])) as AppraisalTemplateBlock[]
    return AppraisalTemplate.fromPersistence({
      id: row.id, org_id: row.org_id,
      kind: row.kind, name: row.name, description: row.description,
      preview_image_url: row.preview_image_url, blocks: blocks as any,
      is_system: !!row.is_system, parent_template_id: row.parent_template_id,
      active: !!row.active, sort_order: row.sort_order,
      created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
