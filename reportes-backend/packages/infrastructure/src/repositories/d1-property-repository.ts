import { Property } from '@reportes/core'
import type { PropertyRepository, PropertyFilters } from '@reportes/core'

export class D1PropertyRepository implements PropertyRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Property | null> {
    const row = await this.db
      .prepare(`SELECT p.*, u.full_name as agent_name FROM properties p LEFT JOIN users u ON p.agent_id = u.id WHERE p.id = ? AND p.org_id = ?`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findBySlug(slug: string): Promise<Property | null> {
    const row = await this.db
      .prepare(`SELECT p.*, u.full_name as agent_name FROM properties p LEFT JOIN users u ON p.agent_id = u.id WHERE p.public_slug = ?`)
      .bind(slug)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: PropertyFilters): Promise<Property[]> {
    let query = `SELECT p.*, u.full_name as agent_name FROM properties p LEFT JOIN users u ON p.agent_id = u.id WHERE p.org_id = ?`
    const binds: unknown[] = [orgId]

    if (filters?.status) { query += ' AND p.status = ?'; binds.push(filters.status) }
    if (filters?.agent_id) { query += ' AND p.agent_id = ?'; binds.push(filters.agent_id) }
    if (filters?.neighborhood) { query += ' AND p.neighborhood = ?'; binds.push(filters.neighborhood) }
    if (filters?.property_type) { query += ' AND p.property_type = ?'; binds.push(filters.property_type) }
    query += ' ORDER BY p.created_at DESC LIMIT 200'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(property: Property): Promise<void> {
    const o = property.toObject()
    await this.db.prepare(`
      INSERT INTO properties (id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
        asking_price, currency, owner_name, owner_phone, owner_email, public_slug, cover_photo,
        agent_id, status, commercial_stage, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        address=excluded.address, neighborhood=excluded.neighborhood, rooms=excluded.rooms,
        size_m2=excluded.size_m2, asking_price=excluded.asking_price, currency=excluded.currency,
        owner_name=excluded.owner_name, owner_phone=excluded.owner_phone, owner_email=excluded.owner_email,
        cover_photo=excluded.cover_photo, status=excluded.status, commercial_stage=excluded.commercial_stage,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.address, o.neighborhood, o.city, o.property_type, o.rooms, o.size_m2,
      o.asking_price, o.currency, o.owner_name, o.owner_phone, o.owner_email, o.public_slug,
      o.cover_photo, o.agent_id, o.status, o.commercial_stage, o.created_at, o.updated_at
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM properties WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Property {
    return Property.create({
      id: row.id, org_id: row.org_id, address: row.address, neighborhood: row.neighborhood,
      city: row.city, property_type: row.property_type, rooms: row.rooms ?? null,
      size_m2: row.size_m2 ?? null, asking_price: row.asking_price ?? null,
      currency: row.currency, owner_name: row.owner_name, owner_phone: row.owner_phone ?? '',
      owner_email: row.owner_email ?? null, public_slug: row.public_slug,
      cover_photo: row.cover_photo ?? null, agent_id: row.agent_id,
      status: row.status, commercial_stage: row.commercial_stage ?? null,
      created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
