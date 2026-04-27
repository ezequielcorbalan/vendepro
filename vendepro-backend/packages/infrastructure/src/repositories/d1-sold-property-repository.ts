import { SoldProperty } from '@vendepro/core'
import type { SoldPropertyRepository, SoldPropertyFilters } from '@vendepro/core'

export class D1SoldPropertyRepository implements SoldPropertyRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string, filters: SoldPropertyFilters = {}): Promise<SoldProperty[]> {
    const where: string[] = ['org_id = ?']
    const binds: any[] = [orgId]

    if (filters.origin && filters.origin !== 'all') {
      if (filters.origin === 'mine') {
        if (filters.currentUserId) {
          where.push('agent_id = ?')
          binds.push(filters.currentUserId)
        } else {
          // si no hay usuario, mine no matchea nada
          where.push('1 = 0')
        }
      } else if (filters.origin === 'team') {
        where.push('agent_id IS NOT NULL')
        if (filters.currentUserId) {
          where.push('agent_id != ?')
          binds.push(filters.currentUserId)
        }
      } else if (filters.origin === 'external') {
        where.push('agent_id IS NULL')
      }
    }

    if (filters.property_type) {
      where.push('property_type = ?')
      binds.push(filters.property_type)
    }
    if (filters.neighborhood) {
      where.push('LOWER(neighborhood) LIKE ?')
      binds.push(`%${filters.neighborhood.toLowerCase()}%`)
    }
    if (typeof filters.min_covered_area === 'number') {
      where.push('covered_area >= ?')
      binds.push(filters.min_covered_area)
    }
    if (typeof filters.max_covered_area === 'number') {
      where.push('covered_area <= ?')
      binds.push(filters.max_covered_area)
    }
    if (filters.closed_after) {
      where.push('closed_at >= ?')
      binds.push(filters.closed_after)
    }
    if (filters.closed_before) {
      where.push('closed_at <= ?')
      binds.push(filters.closed_before)
    }
    if (filters.search) {
      where.push('(LOWER(address_approx) LIKE ? OR LOWER(neighborhood) LIKE ? OR LOWER(notes) LIKE ?)')
      const q = `%${filters.search.toLowerCase()}%`
      binds.push(q, q, q)
    }

    const limit = Math.min(filters.limit ?? 100, 500)
    const offset = filters.offset ?? 0

    const sql = `SELECT * FROM sold_properties WHERE ${where.join(' AND ')}
                 ORDER BY closed_at DESC NULLS LAST, created_at DESC
                 LIMIT ${limit} OFFSET ${offset}`

    const rows = (await this.db.prepare(sql).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findById(id: string, orgId: string): Promise<SoldProperty | null> {
    const row = await this.db
      .prepare(`SELECT * FROM sold_properties WHERE id = ? AND org_id = ? LIMIT 1`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(prop: SoldProperty): Promise<void> {
    const o = prop.toObject()
    await this.db.prepare(`
      INSERT INTO sold_properties (
        id, org_id, property_type, neighborhood, address_approx,
        covered_area, total_area, semi_area, rooms, bedrooms, bathrooms, parking,
        listing_price_usd, closing_price_usd, closed_at, notes,
        agent_id, external_agent_name, external_agency,
        photos_json, shared_with_network, created_by, created_at, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        property_type = excluded.property_type,
        neighborhood = excluded.neighborhood,
        address_approx = excluded.address_approx,
        covered_area = excluded.covered_area,
        total_area = excluded.total_area,
        semi_area = excluded.semi_area,
        rooms = excluded.rooms,
        bedrooms = excluded.bedrooms,
        bathrooms = excluded.bathrooms,
        parking = excluded.parking,
        listing_price_usd = excluded.listing_price_usd,
        closing_price_usd = excluded.closing_price_usd,
        closed_at = excluded.closed_at,
        notes = excluded.notes,
        agent_id = excluded.agent_id,
        external_agent_name = excluded.external_agent_name,
        external_agency = excluded.external_agency,
        photos_json = excluded.photos_json,
        shared_with_network = excluded.shared_with_network,
        updated_at = excluded.updated_at
    `).bind(
      o.id,
      o.org_id,
      o.property_type,
      o.neighborhood,
      o.address_approx,
      o.covered_area,
      o.total_area,
      o.semi_area,
      o.rooms,
      o.bedrooms,
      o.bathrooms,
      o.parking,
      o.listing_price_usd,
      o.closing_price_usd,
      o.closed_at,
      o.notes,
      o.agent_id,
      o.external_agent_name,
      o.external_agency,
      JSON.stringify(o.photos),
      o.shared_with_network ? 1 : 0,
      o.created_by,
      o.created_at,
      o.updated_at,
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM sold_properties WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .run()
  }

  private toEntity(row: any): SoldProperty {
    let photos: string[] = []
    try { photos = row.photos_json ? JSON.parse(row.photos_json) : [] } catch { photos = [] }
    return SoldProperty.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      property_type: row.property_type,
      neighborhood: row.neighborhood ?? null,
      address_approx: row.address_approx ?? null,
      covered_area: row.covered_area ?? null,
      total_area: row.total_area ?? null,
      semi_area: row.semi_area ?? null,
      rooms: row.rooms ?? null,
      bedrooms: row.bedrooms ?? null,
      bathrooms: row.bathrooms ?? null,
      parking: row.parking ?? null,
      listing_price_usd: row.listing_price_usd ?? null,
      closing_price_usd: row.closing_price_usd ?? null,
      closed_at: row.closed_at ?? null,
      notes: row.notes ?? null,
      agent_id: row.agent_id ?? null,
      external_agent_name: row.external_agent_name ?? null,
      external_agency: row.external_agency ?? null,
      photos,
      shared_with_network: !!row.shared_with_network,
      created_by: row.created_by ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
