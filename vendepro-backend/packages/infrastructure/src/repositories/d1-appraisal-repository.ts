import { Appraisal } from '@vendepro/core'
import type { AppraisalRepository, AppraisalFilters, AppraisalComparableProps } from '@vendepro/core'

export class D1AppraisalRepository implements AppraisalRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Appraisal | null> {
    const row = (await this.db
      .prepare(
        `SELECT a.*, u.full_name AS agent_name
         FROM appraisals a
         LEFT JOIN users u ON a.agent_id = u.id
         WHERE a.id = ? AND a.org_id = ?`,
      )
      .bind(id, orgId)
      .first()) as any
    if (!row) return null
    const comparables = await this.loadComparables(id)
    return this.toEntity(row, comparables)
  }

  async findBySlug(slug: string): Promise<Appraisal | null> {
    const row = (await this.db
      .prepare(
        `SELECT a.*, u.full_name AS agent_name
         FROM appraisals a
         LEFT JOIN users u ON a.agent_id = u.id
         WHERE a.public_slug = ?`,
      )
      .bind(slug)
      .first()) as any
    if (!row) return null
    const comparables = await this.loadComparables(row.id)
    return this.toEntity(row, comparables)
  }

  async findByOrg(orgId: string, filters?: AppraisalFilters): Promise<Appraisal[]> {
    let query = `SELECT a.*, u.full_name AS agent_name
                 FROM appraisals a
                 LEFT JOIN users u ON a.agent_id = u.id
                 WHERE a.org_id = ?`
    const binds: unknown[] = [orgId]
    if (filters?.stage) {
      query += ' AND a.status = ?'
      binds.push(filters.stage)
    }
    if (filters?.agent_id) {
      query += ' AND a.agent_id = ?'
      binds.push(filters.agent_id)
    }
    query += ' ORDER BY a.created_at DESC LIMIT 500'

    const rows = ((await this.db.prepare(query).bind(...binds).all()).results as any[]) || []
    return rows.map((r) => this.toEntity(r, []))
  }

  async save(appraisal: Appraisal): Promise<void> {
    const o = appraisal.toObject()
    await this.db
      .prepare(
        `INSERT INTO appraisals (
          id, org_id, property_address, neighborhood, city, property_type,
          covered_area, total_area, semi_area, weighted_area,
          strengths, weaknesses, opportunities, threats, publication_analysis,
          suggested_price, test_price, expected_close_price, usd_per_m2,
          canva_design_id, canva_edit_url, agent_id, lead_id, status,
          public_slug, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          property_address=excluded.property_address,
          neighborhood=excluded.neighborhood,
          city=excluded.city,
          property_type=excluded.property_type,
          covered_area=excluded.covered_area,
          total_area=excluded.total_area,
          semi_area=excluded.semi_area,
          weighted_area=excluded.weighted_area,
          strengths=excluded.strengths,
          weaknesses=excluded.weaknesses,
          opportunities=excluded.opportunities,
          threats=excluded.threats,
          publication_analysis=excluded.publication_analysis,
          suggested_price=excluded.suggested_price,
          test_price=excluded.test_price,
          expected_close_price=excluded.expected_close_price,
          usd_per_m2=excluded.usd_per_m2,
          canva_design_id=excluded.canva_design_id,
          canva_edit_url=excluded.canva_edit_url,
          agent_id=excluded.agent_id,
          lead_id=excluded.lead_id,
          status=excluded.status,
          public_slug=excluded.public_slug,
          updated_at=excluded.updated_at`,
      )
      .bind(
        o.id, o.org_id, o.property_address, o.neighborhood, o.city, o.property_type,
        o.covered_area, o.total_area, o.semi_area, o.weighted_area,
        o.strengths, o.weaknesses, o.opportunities, o.threats, o.publication_analysis,
        o.suggested_price, o.test_price, o.expected_close_price, o.usd_per_m2,
        o.canva_design_id, o.canva_edit_url, o.agent_id, o.lead_id, o.status,
        o.public_slug, o.created_at, o.updated_at,
      )
      .run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    // Comparables cascade via ON DELETE CASCADE FK
    await this.db.prepare('DELETE FROM appraisals WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private async loadComparables(appraisalId: string): Promise<AppraisalComparableProps[]> {
    const rows = ((await this.db
      .prepare(
        `SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order ASC, rowid ASC`,
      )
      .bind(appraisalId)
      .all()).results as any[]) || []
    return rows.map((r) => ({
      id: r.id,
      appraisal_id: r.appraisal_id,
      zonaprop_url: r.zonaprop_url ?? null,
      address: r.address ?? null,
      total_area: r.total_area ?? null,
      covered_area: r.covered_area ?? null,
      price: r.price ?? null,
      usd_per_m2: r.usd_per_m2 ?? null,
      days_on_market: r.days_on_market ?? null,
      views_per_day: r.views_per_day ?? null,
      age: r.age ?? null,
      sort_order: r.sort_order ?? 0,
    }))
  }

  private toEntity(row: any, comparables: AppraisalComparableProps[]): Appraisal {
    return Appraisal.create({
      id: row.id,
      org_id: row.org_id,
      property_address: row.property_address,
      neighborhood: row.neighborhood,
      city: row.city,
      property_type: row.property_type,
      covered_area: row.covered_area ?? null,
      total_area: row.total_area ?? null,
      semi_area: row.semi_area ?? null,
      weighted_area: row.weighted_area ?? null,
      strengths: row.strengths ?? null,
      weaknesses: row.weaknesses ?? null,
      opportunities: row.opportunities ?? null,
      threats: row.threats ?? null,
      publication_analysis: row.publication_analysis ?? null,
      suggested_price: row.suggested_price ?? null,
      test_price: row.test_price ?? null,
      expected_close_price: row.expected_close_price ?? null,
      usd_per_m2: row.usd_per_m2 ?? null,
      canva_design_id: row.canva_design_id ?? null,
      canva_edit_url: row.canva_edit_url ?? null,
      agent_id: row.agent_id,
      lead_id: row.lead_id ?? null,
      status: row.status,
      public_slug: row.public_slug ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      comparables,
      agent_name: row.agent_name ?? undefined,
    })
  }
}
