import { Landing, type LandingKind, type LeadRules } from '@vendepro/core'
import type { LandingRepository, LandingFilters } from '@vendepro/core'
import type { LandingStatusValue } from '@vendepro/core'
import type { Block } from '@vendepro/core'

export class D1LandingRepository implements LandingRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Landing | null> {
    const row = await this.db
      .prepare(`SELECT * FROM landings WHERE id = ? AND org_id = ?`)
      .bind(id, orgId).first() as any
    return row ? this.toEntity(row) : null
  }

  async findByFullSlug(fullSlug: string): Promise<Landing | null> {
    const row = await this.db
      .prepare(`SELECT * FROM landings WHERE full_slug = ?`)
      .bind(fullSlug).first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: LandingFilters): Promise<Landing[]> {
    let q = `SELECT * FROM landings WHERE org_id = ?`
    const binds: unknown[] = [orgId]
    if (filters?.agent_id) { q += ` AND agent_id = ?`; binds.push(filters.agent_id) }
    if (filters?.kind) { q += ` AND kind = ?`; binds.push(filters.kind) }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        q += ` AND status IN (${filters.status.map(() => '?').join(',')})`
        binds.push(...filters.status)
      } else {
        q += ` AND status = ?`; binds.push(filters.status)
      }
    }
    q += ` ORDER BY updated_at DESC LIMIT 200`
    const rows = (await this.db.prepare(q).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(landing: Landing): Promise<void> {
    const o = landing.toObject()
    await this.db.prepare(`
      INSERT INTO landings (id, org_id, agent_id, template_id, kind, slug_base, slug_suffix, full_slug,
        status, blocks_json, brand_voice, lead_rules_json, seo_title, seo_description, og_image_url,
        published_version_id, published_at, published_by, last_review_note, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        slug_base=excluded.slug_base,
        slug_suffix=excluded.slug_suffix,
        full_slug=excluded.full_slug,
        status=excluded.status,
        blocks_json=excluded.blocks_json,
        brand_voice=excluded.brand_voice,
        lead_rules_json=excluded.lead_rules_json,
        seo_title=excluded.seo_title,
        seo_description=excluded.seo_description,
        og_image_url=excluded.og_image_url,
        published_version_id=excluded.published_version_id,
        published_at=excluded.published_at,
        published_by=excluded.published_by,
        last_review_note=excluded.last_review_note,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.agent_id, o.template_id, o.kind, o.slug_base, o.slug_suffix, `${o.slug_base}-${o.slug_suffix}`,
      o.status, JSON.stringify(o.blocks), o.brand_voice, o.lead_rules ? JSON.stringify(o.lead_rules) : null,
      o.seo_title, o.seo_description, o.og_image_url,
      o.published_version_id, o.published_at, o.published_by, o.last_review_note,
      o.created_at, o.updated_at,
    ).run()
  }

  async existsFullSlug(fullSlug: string): Promise<boolean> {
    const r = await this.db.prepare(`SELECT 1 AS ok FROM landings WHERE full_slug = ? LIMIT 1`).bind(fullSlug).first() as any
    return !!r
  }

  private toEntity(row: any): Landing {
    const blocks = JSON.parse(row.blocks_json) as Block[]
    const leadRules: LeadRules | null = row.lead_rules_json ? JSON.parse(row.lead_rules_json) : null
    return Landing.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      agent_id: row.agent_id,
      template_id: row.template_id,
      kind: row.kind as LandingKind,
      slug_base: row.slug_base,
      slug_suffix: row.slug_suffix,
      status: row.status as LandingStatusValue,
      blocks,
      brand_voice: row.brand_voice,
      lead_rules: leadRules,
      seo_title: row.seo_title,
      seo_description: row.seo_description,
      og_image_url: row.og_image_url,
      published_version_id: row.published_version_id,
      published_at: row.published_at,
      published_by: row.published_by,
      last_review_note: row.last_review_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
