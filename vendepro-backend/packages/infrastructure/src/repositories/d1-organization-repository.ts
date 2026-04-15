// packages/infrastructure/src/repositories/d1-organization-repository.ts
import { Organization } from '@vendepro/core'
import type { OrganizationRepository } from '@vendepro/core'

export class D1OrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: D1Database) {}

  async findBySlug(slug: string): Promise<Organization | null> {
    const row = await this.db
      .prepare('SELECT * FROM organizations WHERE slug = ?')
      .bind(slug)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(org: Organization): Promise<void> {
    const o = org.toObject()
    await this.db.prepare(`
      INSERT INTO organizations (id, name, slug, logo_url, brand_color, brand_accent_color, canva_template_id, canva_report_template_id, owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, slug=excluded.slug, logo_url=excluded.logo_url,
        brand_color=excluded.brand_color, brand_accent_color=excluded.brand_accent_color,
        canva_template_id=excluded.canva_template_id, canva_report_template_id=excluded.canva_report_template_id,
        owner_id=excluded.owner_id
    `).bind(
      o.id, o.name, o.slug, o.logo_url, o.brand_color, o.brand_accent_color,
      o.canva_template_id, o.canva_report_template_id, o.owner_id, o.created_at
    ).run()
  }

  private toEntity(row: any): Organization {
    return Organization.create({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo_url: row.logo_url ?? null,
      brand_color: row.brand_color ?? '#ff007c',
      brand_accent_color: row.brand_accent_color ?? null,
      canva_template_id: row.canva_template_id ?? null,
      canva_report_template_id: row.canva_report_template_id ?? null,
      owner_id: row.owner_id ?? null,
      created_at: row.created_at,
    })
  }
}
