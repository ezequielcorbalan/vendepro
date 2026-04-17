import { TemplateBlock } from '@vendepro/core'
import type { TemplateBlockRepository } from '@vendepro/core'

export class D1TemplateBlockRepository implements TemplateBlockRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string): Promise<TemplateBlock[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM tasacion_template_blocks WHERE org_id = ? ORDER BY sort_order')
      .bind(orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findEnabledByOrg(orgId: string): Promise<TemplateBlock[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM tasacion_template_blocks WHERE org_id = ? AND enabled = 1 ORDER BY sort_order')
      .bind(orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findById(id: string, orgId: string): Promise<TemplateBlock | null> {
    const row = await this.db
      .prepare('SELECT * FROM tasacion_template_blocks WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(block: TemplateBlock): Promise<void> {
    const o = block.toObject()
    await this.db.prepare(`
      INSERT INTO tasacion_template_blocks (id, org_id, block_type, title, description, icon,
        number_label, video_url, image_url, sort_order, enabled, section, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        block_type=excluded.block_type, title=excluded.title, description=excluded.description,
        icon=excluded.icon, number_label=excluded.number_label, video_url=excluded.video_url,
        image_url=excluded.image_url, sort_order=excluded.sort_order, enabled=excluded.enabled,
        section=excluded.section, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.block_type, o.title, o.description, o.icon, o.number_label,
      o.video_url, o.image_url, o.sort_order, o.enabled, o.section, o.created_at, o.updated_at
    ).run()
  }

  async updateOrder(blocks: Array<{ id: string; sort_order: number }>, orgId: string): Promise<void> {
    const stmts = blocks.map(b =>
      this.db.prepare('UPDATE tasacion_template_blocks SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ? AND org_id = ?')
        .bind(b.sort_order, b.id, orgId)
    )
    if (stmts.length > 0) await this.db.batch(stmts)
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM tasacion_template_blocks WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): TemplateBlock {
    return TemplateBlock.create({
      id: row.id, org_id: row.org_id, block_type: row.block_type, title: row.title,
      description: row.description ?? null, icon: row.icon ?? null, number_label: row.number_label ?? null,
      video_url: row.video_url ?? null, image_url: row.image_url ?? null, sort_order: row.sort_order ?? 0,
      enabled: row.enabled ?? 1, section: row.section ?? 'commercial',
      created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
