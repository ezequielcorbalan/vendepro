import { WhatsAppTemplate } from '@vendepro/core'
import type { WhatsAppTemplateRepository } from '@vendepro/core'

export class D1WhatsAppTemplateRepository implements WhatsAppTemplateRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string, opts?: { onlyActive?: boolean }): Promise<WhatsAppTemplate[]> {
    const rows = (await this.db
      .prepare(`
        SELECT * FROM whatsapp_templates
        WHERE org_id = ?${opts?.onlyActive ? ' AND is_active = 1' : ''}
        ORDER BY sort_order, name
      `)
      .bind(orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findById(id: string, orgId: string): Promise<WhatsAppTemplate | null> {
    const row = await this.db
      .prepare('SELECT * FROM whatsapp_templates WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(template: WhatsAppTemplate): Promise<void> {
    const o = template.toObject()
    await this.db.prepare(`
      INSERT INTO whatsapp_templates (id, org_id, name, body, sort_order, is_active, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        body = excluded.body,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).bind(
      o.id, o.org_id, o.name, o.body, o.sort_order, o.is_active,
      o.created_by, o.created_at, o.updated_at,
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM whatsapp_templates WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): WhatsAppTemplate {
    return WhatsAppTemplate.create({
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      body: row.body,
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active ?? 1,
      created_by: row.created_by ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
