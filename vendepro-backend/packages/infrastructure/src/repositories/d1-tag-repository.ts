import { Tag } from '@vendepro/core'
import type { TagRepository } from '@vendepro/core'

export class D1TagRepository implements TagRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string): Promise<Tag[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM tags WHERE org_id = ? ORDER BY name')
      .bind(orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findByLead(leadId: string, orgId: string): Promise<Tag[]> {
    const rows = (await this.db
      .prepare('SELECT t.* FROM tags t INNER JOIN lead_tags lt ON t.id = lt.tag_id WHERE lt.lead_id = ? AND t.org_id = ?')
      .bind(leadId, orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findByName(orgId: string, name: string): Promise<Tag | null> {
    const row = await this.db
      .prepare('SELECT * FROM tags WHERE org_id = ? AND LOWER(name) = LOWER(?)')
      .bind(orgId, name)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(tag: Tag): Promise<void> {
    const o = tag.toObject()
    await this.db.prepare(`
      INSERT INTO tags (id, org_id, name, color, is_default, created_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color
    `).bind(o.id, o.org_id, o.name, o.color, o.is_default, o.created_at).run()
  }

  async addToLead(leadId: string, tagId: string, orgId: string): Promise<void> {
    // lead_tags no tiene org_id: el pertenecer a la org se verifica via tags
    await this.db.prepare(`
      INSERT OR IGNORE INTO lead_tags (lead_id, tag_id)
      SELECT ?, id FROM tags WHERE id = ? AND org_id = ?
    `).bind(leadId, tagId, orgId).run()
  }

  async removeFromLead(leadId: string, tagId: string, orgId: string): Promise<void> {
    await this.db.prepare(`
      DELETE FROM lead_tags
      WHERE lead_id = ? AND tag_id IN (SELECT id FROM tags WHERE id = ? AND org_id = ?)
    `).bind(leadId, tagId, orgId).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM tags WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Tag {
    return Tag.create({ id: row.id, org_id: row.org_id, name: row.name, color: row.color ?? null, is_default: row.is_default ?? 0, created_at: row.created_at })
  }
}
