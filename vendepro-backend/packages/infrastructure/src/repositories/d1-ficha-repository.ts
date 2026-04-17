import { FichaTasacion } from '@vendepro/core'
import type { FichaRepository } from '@vendepro/core'

/**
 * D1 adapter for the `fichas_tasacion` table.
 *
 * Schema notes:
 * - `fichas_tasacion` has NO `public_slug` column, so `findPublicBySlug()`
 *   always returns null. Kept in the interface for future use.
 * - Photos are stored as TEXT (JSON-encoded string) in the column; the entity
 *   also exposes them as a string — no transformation needed.
 */
export class D1FichaRepository implements FichaRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<FichaTasacion | null> {
    const row = (await this.db
      .prepare(`SELECT * FROM fichas_tasacion WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async findByAppraisal(appraisalId: string, orgId: string): Promise<FichaTasacion[]> {
    const rows = ((await this.db
      .prepare(
        `SELECT * FROM fichas_tasacion WHERE appraisal_id = ? AND org_id = ? ORDER BY created_at DESC`,
      )
      .bind(appraisalId, orgId)
      .all()).results as any[]) || []
    return rows.map((r) => this.toEntity(r))
  }

  async findPublicBySlug(_slug: string): Promise<FichaTasacion | null> {
    // fichas_tasacion has no public_slug column in the v2 schema.
    return null
  }

  async save(ficha: FichaTasacion): Promise<void> {
    const o = ficha.toObject()
    await this.db
      .prepare(
        `INSERT INTO fichas_tasacion (
          id, org_id, agent_id, lead_id, appraisal_id, inspection_date,
          address, neighborhood, property_type, floor_number, elevators, age,
          building_category, property_condition, covered_area, semi_area, uncovered_area,
          m2_value_neighborhood, m2_value_zone, bedrooms, bathrooms, storage_rooms,
          parking_spots, air_conditioning, bedroom_dimensions, living_dimensions,
          kitchen_dimensions, bathroom_dimensions, floor_type, disposition, orientation,
          balcony_type, heating_type, noise_level, amenities, is_professional,
          is_occupied, is_credit_eligible, sells_to_buy, expenses, abl, aysa,
          notes, photos, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          agent_id=excluded.agent_id,
          lead_id=excluded.lead_id,
          appraisal_id=excluded.appraisal_id,
          inspection_date=excluded.inspection_date,
          address=excluded.address,
          neighborhood=excluded.neighborhood,
          property_type=excluded.property_type,
          floor_number=excluded.floor_number,
          elevators=excluded.elevators,
          age=excluded.age,
          building_category=excluded.building_category,
          property_condition=excluded.property_condition,
          covered_area=excluded.covered_area,
          semi_area=excluded.semi_area,
          uncovered_area=excluded.uncovered_area,
          m2_value_neighborhood=excluded.m2_value_neighborhood,
          m2_value_zone=excluded.m2_value_zone,
          bedrooms=excluded.bedrooms,
          bathrooms=excluded.bathrooms,
          storage_rooms=excluded.storage_rooms,
          parking_spots=excluded.parking_spots,
          air_conditioning=excluded.air_conditioning,
          bedroom_dimensions=excluded.bedroom_dimensions,
          living_dimensions=excluded.living_dimensions,
          kitchen_dimensions=excluded.kitchen_dimensions,
          bathroom_dimensions=excluded.bathroom_dimensions,
          floor_type=excluded.floor_type,
          disposition=excluded.disposition,
          orientation=excluded.orientation,
          balcony_type=excluded.balcony_type,
          heating_type=excluded.heating_type,
          noise_level=excluded.noise_level,
          amenities=excluded.amenities,
          is_professional=excluded.is_professional,
          is_occupied=excluded.is_occupied,
          is_credit_eligible=excluded.is_credit_eligible,
          sells_to_buy=excluded.sells_to_buy,
          expenses=excluded.expenses,
          abl=excluded.abl,
          aysa=excluded.aysa,
          notes=excluded.notes,
          photos=excluded.photos,
          updated_at=excluded.updated_at`,
      )
      .bind(
        o.id, o.org_id, o.agent_id, o.lead_id, o.appraisal_id, o.inspection_date,
        o.address, o.neighborhood, o.property_type, o.floor_number, o.elevators, o.age,
        o.building_category, o.property_condition, o.covered_area, o.semi_area, o.uncovered_area,
        o.m2_value_neighborhood, o.m2_value_zone, o.bedrooms, o.bathrooms, o.storage_rooms,
        o.parking_spots, o.air_conditioning, o.bedroom_dimensions, o.living_dimensions,
        o.kitchen_dimensions, o.bathroom_dimensions, o.floor_type, o.disposition, o.orientation,
        o.balcony_type, o.heating_type, o.noise_level, o.amenities, o.is_professional,
        o.is_occupied, o.is_credit_eligible, o.sells_to_buy, o.expenses, o.abl, o.aysa,
        o.notes, o.photos, o.created_at, o.updated_at,
      )
      .run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM fichas_tasacion WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): FichaTasacion {
    return FichaTasacion.create({
      id: row.id,
      org_id: row.org_id,
      agent_id: row.agent_id,
      lead_id: row.lead_id ?? null,
      appraisal_id: row.appraisal_id ?? null,
      inspection_date: row.inspection_date ?? null,
      address: row.address,
      neighborhood: row.neighborhood ?? null,
      property_type: row.property_type ?? null,
      floor_number: row.floor_number ?? null,
      elevators: row.elevators ?? null,
      age: row.age ?? null,
      building_category: row.building_category ?? null,
      property_condition: row.property_condition ?? null,
      covered_area: row.covered_area ?? null,
      semi_area: row.semi_area ?? null,
      uncovered_area: row.uncovered_area ?? null,
      m2_value_neighborhood: row.m2_value_neighborhood ?? null,
      m2_value_zone: row.m2_value_zone ?? null,
      bedrooms: row.bedrooms ?? null,
      bathrooms: row.bathrooms ?? null,
      storage_rooms: row.storage_rooms ?? null,
      parking_spots: row.parking_spots ?? null,
      air_conditioning: row.air_conditioning ?? null,
      bedroom_dimensions: row.bedroom_dimensions ?? null,
      living_dimensions: row.living_dimensions ?? null,
      kitchen_dimensions: row.kitchen_dimensions ?? null,
      bathroom_dimensions: row.bathroom_dimensions ?? null,
      floor_type: row.floor_type ?? null,
      disposition: row.disposition ?? null,
      orientation: row.orientation ?? null,
      balcony_type: row.balcony_type ?? null,
      heating_type: row.heating_type ?? null,
      noise_level: row.noise_level ?? null,
      amenities: row.amenities ?? null,
      is_professional: row.is_professional ?? 0,
      is_occupied: row.is_occupied ?? 0,
      is_credit_eligible: row.is_credit_eligible ?? 0,
      sells_to_buy: row.sells_to_buy ?? 0,
      expenses: row.expenses ?? null,
      abl: row.abl ?? null,
      aysa: row.aysa ?? null,
      notes: row.notes ?? null,
      photos: row.photos ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
