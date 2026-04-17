import { Property } from '@vendepro/core'
import type { PropertyRepository, PropertyFilters } from '@vendepro/core'

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

    // Legacy text filters (kept for compatibility)
    if (filters?.status) { query += ' AND COALESCE(p.status, \'active\') = ?'; binds.push(filters.status) }
    if (filters?.agent_id) { query += ' AND p.agent_id = ?'; binds.push(filters.agent_id) }
    if (filters?.neighborhood) { query += ' AND p.neighborhood = ?'; binds.push(filters.neighborhood) }
    if (filters?.property_type) { query += ' AND p.property_type = ?'; binds.push(filters.property_type) }

    // ID-based filters (preferred)
    if (filters?.operation_type_id) {
      query += ' AND COALESCE(p.operation_type_id, 1) = ?'
      binds.push(filters.operation_type_id)
    } else if (filters?.operation_type) {
      query += ' AND LOWER(COALESCE(p.operation_type, \'venta\')) = ?'
      binds.push(filters.operation_type.toLowerCase())
    }

    if (filters?.commercial_stage_id) {
      query += ' AND p.commercial_stage_id = ?'
      binds.push(filters.commercial_stage_id)
    } else if (filters?.commercial_stage && filters?.operation_type_id) {
      // Slug + operation type → resolve to ID via subquery
      query += ' AND p.commercial_stage_id = (SELECT id FROM commercial_stages WHERE slug = ? AND operation_type_id = ? LIMIT 1)'
      binds.push(filters.commercial_stage, filters.operation_type_id)
    } else if (filters?.commercial_stage) {
      // Slug only → match across all operation types
      query += ' AND p.commercial_stage_id IN (SELECT id FROM commercial_stages WHERE slug = ?)'
      binds.push(filters.commercial_stage)
    }

    if (filters?.status_id) {
      query += ' AND COALESCE(p.status_id, 1) = ?'
      binds.push(filters.status_id)
    }

    if (filters?.search) {
      query += ' AND (p.address LIKE ? OR p.neighborhood LIKE ?)'
      binds.push(`%${filters.search}%`, `%${filters.search}%`)
    }
    query += ' ORDER BY p.created_at DESC LIMIT 200'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(property: Property): Promise<void> {
    const o = property.toObject()
    await this.db.prepare(`
      INSERT INTO properties (id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
        asking_price, currency, owner_name, owner_phone, owner_email, contact_id, public_slug, cover_photo,
        agent_id, status, commercial_stage, operation_type,
        operation_type_id, commercial_stage_id, status_id,
        lead_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        address=excluded.address, neighborhood=excluded.neighborhood, rooms=excluded.rooms,
        size_m2=excluded.size_m2, asking_price=excluded.asking_price, currency=excluded.currency,
        owner_name=excluded.owner_name, owner_phone=excluded.owner_phone, owner_email=excluded.owner_email,
        contact_id=excluded.contact_id, cover_photo=excluded.cover_photo,
        status=excluded.status, commercial_stage=excluded.commercial_stage,
        operation_type=excluded.operation_type,
        operation_type_id=excluded.operation_type_id,
        commercial_stage_id=excluded.commercial_stage_id,
        status_id=excluded.status_id,
        lead_id=excluded.lead_id, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.address, o.neighborhood, o.city, o.property_type, o.rooms, o.size_m2,
      o.asking_price, o.currency, o.owner_name, o.owner_phone, o.owner_email, o.contact_id ?? null,
      o.public_slug, o.cover_photo, o.agent_id,
      o.status, o.commercial_stage, o.operation_type ?? 'venta',
      o.operation_type_id ?? 1, o.commercial_stage_id ?? null, o.status_id ?? 1,
      o.lead_id ?? null,
      o.created_at, o.updated_at
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM properties WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Property {
    const validTypes = ['departamento', 'casa', 'ph', 'local', 'terreno', 'oficina']
    return Property.create({
      id: row.id, org_id: row.org_id,
      address: row.address || 'Sin dirección',
      neighborhood: row.neighborhood || 'Sin barrio',
      city: row.city || '',
      property_type: validTypes.includes(row.property_type) ? row.property_type : 'departamento',
      rooms: row.rooms ?? null,
      size_m2: row.size_m2 ?? null,
      asking_price: row.asking_price ?? null,
      currency: row.currency || 'USD',
      owner_name: row.owner_name || 'Sin propietario',
      owner_phone: row.owner_phone ?? null,
      owner_email: row.owner_email ?? null,
      contact_id: row.contact_id ?? null,
      public_slug: row.public_slug || row.id,
      cover_photo: row.cover_photo ?? null,
      agent_id: row.agent_id,
      status: row.status,
      commercial_stage: row.commercial_stage ?? null,
      operation_type: row.operation_type ?? 'venta',
      operation_type_id: row.operation_type_id ?? 1,
      commercial_stage_id: row.commercial_stage_id ?? null,
      status_id: row.status_id ?? 1,
      contact_id: row.contact_id ?? null,
      lead_id: row.lead_id ?? null,
      created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
