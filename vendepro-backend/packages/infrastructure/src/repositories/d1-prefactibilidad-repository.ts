import { Prefactibilidad } from '@vendepro/core'
import type { PrefactibilidadRepository, PrefactPublicResult } from '@vendepro/core'

/**
 * D1 adapter for `prefactibilidades`.
 *
 * Schema notes:
 * - `lot_photos`, `units_mix`, `project_renders`, `amenities`, `comparables`,
 *   `timeline` are stored as JSON-encoded TEXT. The entity exposes them as
 *   `string | null`, so no serialization happens here — callers pass pre-encoded
 *   strings and receive them back verbatim.
 */
export class D1PrefactibilidadRepository implements PrefactibilidadRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Prefactibilidad | null> {
    const row = (await this.db
      .prepare(`SELECT * FROM prefactibilidades WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string): Promise<Prefactibilidad[]> {
    const rows = ((await this.db
      .prepare(`SELECT * FROM prefactibilidades WHERE org_id = ? ORDER BY created_at DESC LIMIT 500`)
      .bind(orgId)
      .all()).results as any[]) || []
    return rows.map((r) => this.toEntity(r))
  }

  async findPublicBySlug(slug: string): Promise<Prefactibilidad | null> {
    const row = (await this.db
      .prepare(`SELECT * FROM prefactibilidades WHERE public_slug = ?`)
      .bind(slug)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async findPublicBySlugWithOrg(slug: string): Promise<PrefactPublicResult | null> {
    const row = (await this.db
      .prepare(
        `SELECT pf.*, o.name AS org_name, o.logo_url AS org_logo_url, o.brand_color AS org_brand_color
         FROM prefactibilidades pf
         LEFT JOIN organizations o ON pf.org_id = o.id
         WHERE pf.public_slug = ?`,
      )
      .bind(slug)
      .first()) as any
    if (!row) return null
    return {
      prefact: this.toEntity(row),
      org: {
        name: row.org_name ?? '',
        logo_url: row.org_logo_url ?? null,
        brand_color: row.org_brand_color ?? null,
      },
    }
  }

  async save(p: Prefactibilidad): Promise<void> {
    const o = p.toObject()
    await this.db
      .prepare(
        `INSERT INTO prefactibilidades (
          id, org_id, agent_id, lead_id, public_slug, status,
          address, neighborhood, city,
          lot_area, lot_frontage, lot_depth, zoning, fot, fos, max_height,
          lot_price, lot_price_per_m2, lot_description, lot_photos,
          project_name, project_description, buildable_area, total_units, units_mix,
          parking_spots, amenities, project_renders,
          construction_cost_per_m2, total_construction_cost, professional_fees,
          permits_cost, commercialization_cost, other_costs, total_investment,
          avg_sale_price_per_m2, total_sellable_area, projected_revenue,
          gross_margin, margin_pct, tir, payback_months,
          comparables, timeline, executive_summary, recommendation,
          video_url, agent_notes, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          agent_id=excluded.agent_id, lead_id=excluded.lead_id, public_slug=excluded.public_slug,
          status=excluded.status, address=excluded.address, neighborhood=excluded.neighborhood,
          city=excluded.city, lot_area=excluded.lot_area, lot_frontage=excluded.lot_frontage,
          lot_depth=excluded.lot_depth, zoning=excluded.zoning, fot=excluded.fot, fos=excluded.fos,
          max_height=excluded.max_height, lot_price=excluded.lot_price,
          lot_price_per_m2=excluded.lot_price_per_m2, lot_description=excluded.lot_description,
          lot_photos=excluded.lot_photos, project_name=excluded.project_name,
          project_description=excluded.project_description, buildable_area=excluded.buildable_area,
          total_units=excluded.total_units, units_mix=excluded.units_mix,
          parking_spots=excluded.parking_spots, amenities=excluded.amenities,
          project_renders=excluded.project_renders,
          construction_cost_per_m2=excluded.construction_cost_per_m2,
          total_construction_cost=excluded.total_construction_cost,
          professional_fees=excluded.professional_fees, permits_cost=excluded.permits_cost,
          commercialization_cost=excluded.commercialization_cost,
          other_costs=excluded.other_costs, total_investment=excluded.total_investment,
          avg_sale_price_per_m2=excluded.avg_sale_price_per_m2,
          total_sellable_area=excluded.total_sellable_area,
          projected_revenue=excluded.projected_revenue, gross_margin=excluded.gross_margin,
          margin_pct=excluded.margin_pct, tir=excluded.tir, payback_months=excluded.payback_months,
          comparables=excluded.comparables, timeline=excluded.timeline,
          executive_summary=excluded.executive_summary, recommendation=excluded.recommendation,
          video_url=excluded.video_url, agent_notes=excluded.agent_notes,
          updated_at=excluded.updated_at`,
      )
      .bind(
        o.id, o.org_id, o.agent_id, o.lead_id, o.public_slug, o.status,
        o.address, o.neighborhood, o.city,
        o.lot_area, o.lot_frontage, o.lot_depth, o.zoning, o.fot, o.fos, o.max_height,
        o.lot_price, o.lot_price_per_m2, o.lot_description, o.lot_photos,
        o.project_name, o.project_description, o.buildable_area, o.total_units, o.units_mix,
        o.parking_spots, o.amenities, o.project_renders,
        o.construction_cost_per_m2, o.total_construction_cost, o.professional_fees,
        o.permits_cost, o.commercialization_cost, o.other_costs, o.total_investment,
        o.avg_sale_price_per_m2, o.total_sellable_area, o.projected_revenue,
        o.gross_margin, o.margin_pct, o.tir, o.payback_months,
        o.comparables, o.timeline, o.executive_summary, o.recommendation,
        o.video_url, o.agent_notes, o.created_at, o.updated_at,
      )
      .run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM prefactibilidades WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Prefactibilidad {
    return Prefactibilidad.create({
      id: row.id,
      org_id: row.org_id,
      agent_id: row.agent_id,
      lead_id: row.lead_id ?? null,
      public_slug: row.public_slug ?? null,
      status: row.status,
      address: row.address,
      neighborhood: row.neighborhood ?? null,
      city: row.city,
      lot_area: row.lot_area ?? null,
      lot_frontage: row.lot_frontage ?? null,
      lot_depth: row.lot_depth ?? null,
      zoning: row.zoning ?? null,
      fot: row.fot ?? null,
      fos: row.fos ?? null,
      max_height: row.max_height ?? null,
      lot_price: row.lot_price ?? null,
      lot_price_per_m2: row.lot_price_per_m2 ?? null,
      lot_description: row.lot_description ?? null,
      lot_photos: row.lot_photos ?? null,
      project_name: row.project_name ?? null,
      project_description: row.project_description ?? null,
      buildable_area: row.buildable_area ?? null,
      total_units: row.total_units ?? null,
      units_mix: row.units_mix ?? null,
      parking_spots: row.parking_spots ?? null,
      amenities: row.amenities ?? null,
      project_renders: row.project_renders ?? null,
      construction_cost_per_m2: row.construction_cost_per_m2 ?? null,
      total_construction_cost: row.total_construction_cost ?? null,
      professional_fees: row.professional_fees ?? null,
      permits_cost: row.permits_cost ?? null,
      commercialization_cost: row.commercialization_cost ?? null,
      other_costs: row.other_costs ?? null,
      total_investment: row.total_investment ?? null,
      avg_sale_price_per_m2: row.avg_sale_price_per_m2 ?? null,
      total_sellable_area: row.total_sellable_area ?? null,
      projected_revenue: row.projected_revenue ?? null,
      gross_margin: row.gross_margin ?? null,
      margin_pct: row.margin_pct ?? null,
      tir: row.tir ?? null,
      payback_months: row.payback_months ?? null,
      comparables: row.comparables ?? null,
      timeline: row.timeline ?? null,
      executive_summary: row.executive_summary ?? null,
      recommendation: row.recommendation ?? null,
      video_url: row.video_url ?? null,
      agent_notes: row.agent_notes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
