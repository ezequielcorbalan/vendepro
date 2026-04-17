import { Property } from '@vendepro/core'
import type { PropertyRepository, PropertyFilters, PropertyProps, PropertyPhoto, OperationType, CommercialStage, PropertyStatusCatalog } from '@vendepro/core'

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

  async findPhotos(propertyId: string, orgId: string): Promise<PropertyPhoto[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM property_photos WHERE property_id = ? AND org_id = ? ORDER BY sort_order')
      .bind(propertyId, orgId)
      .all()).results as any[]
    return rows.map(r => ({
      id: r.id,
      property_id: r.property_id,
      org_id: r.org_id,
      url: r.url,
      r2_key: r.r2_key,
      sort_order: r.sort_order ?? 0,
      created_at: r.created_at,
    }))
  }

  async addPhoto(photo: PropertyPhoto): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO property_photos (id, org_id, property_id, url, r2_key, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(photo.id, photo.org_id, photo.property_id, photo.url, photo.r2_key, photo.sort_order, photo.created_at)
      .run()
  }

  async deletePhoto(photoId: string, orgId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM property_photos WHERE id = ? AND org_id = ?')
      .bind(photoId, orgId)
      .run()
  }

  async reorderPhotos(
    propertyId: string,
    orgId: string,
    order: Array<{ id: string; sort_order: number }>,
  ): Promise<void> {
    for (const item of order) {
      await this.db
        .prepare('UPDATE property_photos SET sort_order = ? WHERE id = ? AND property_id = ? AND org_id = ?')
        .bind(item.sort_order, item.id, propertyId, orgId)
        .run()
    }
  }

  async update(id: string, orgId: string, patch: Partial<PropertyProps>): Promise<void> {
    if (Object.keys(patch).length === 0) return
    await this.db
      .prepare(`
        UPDATE properties
        SET address = COALESCE(?, address),
            neighborhood = COALESCE(?, neighborhood),
            city = COALESCE(?, city),
            property_type = COALESCE(?, property_type),
            rooms = COALESCE(?, rooms),
            size_m2 = COALESCE(?, size_m2),
            asking_price = COALESCE(?, asking_price),
            currency = COALESCE(?, currency),
            owner_name = COALESCE(?, owner_name),
            owner_phone = COALESCE(?, owner_phone),
            owner_email = COALESCE(?, owner_email),
            contact_id = COALESCE(?, contact_id),
            status = COALESCE(?, status),
            commercial_stage = COALESCE(?, commercial_stage),
            commercial_stage_id = COALESCE(?, commercial_stage_id),
            operation_type = COALESCE(?, operation_type),
            operation_type_id = COALESCE(?, operation_type_id),
            status_id = COALESCE(?, status_id),
            updated_at = datetime('now')
        WHERE id = ? AND org_id = ?
      `)
      .bind(
        patch.address ?? null,
        patch.neighborhood ?? null,
        patch.city ?? null,
        patch.property_type ?? null,
        patch.rooms ?? null,
        patch.size_m2 ?? null,
        patch.asking_price ?? null,
        patch.currency ?? null,
        patch.owner_name ?? null,
        patch.owner_phone ?? null,
        patch.owner_email ?? null,
        patch.contact_id ?? null,
        patch.status ?? null,
        patch.commercial_stage ?? null,
        patch.commercial_stage_id ?? null,
        patch.operation_type ?? null,
        patch.operation_type_id ?? null,
        patch.status_id ?? null,
        id,
        orgId,
      )
      .run()
  }

  async updateStage(id: string, orgId: string, stageSlug: string): Promise<void> {
    const stageRow = await this.db
      .prepare(`
        SELECT cs.id as stage_id, cs.slug as stage_slug
        FROM commercial_stages cs
        JOIN properties p ON cs.operation_type_id = p.operation_type_id
        WHERE p.id = ? AND cs.slug = ?
      `)
      .bind(id, stageSlug)
      .first() as any
    if (!stageRow) throw new Error('invalid stage')

    await this.db
      .prepare(`
        UPDATE properties
        SET commercial_stage = ?, commercial_stage_id = ?, updated_at = datetime('now')
        WHERE id = ? AND org_id = ?
      `)
      .bind(stageRow.stage_slug, stageRow.stage_id, id, orgId)
      .run()
  }

  async findCatalogs(): Promise<{
    operation_types: OperationType[]
    commercial_stages: CommercialStage[]
    property_statuses: PropertyStatusCatalog[]
  }> {
    const [opTypesRes, stagesRes, statusesRes] = await Promise.all([
      this.db.prepare('SELECT id, slug, label FROM operation_types ORDER BY id').all(),
      this.db
        .prepare(
          'SELECT id, operation_type_id, slug, label, sort_order, is_terminal, color FROM commercial_stages ORDER BY operation_type_id, sort_order',
        )
        .all(),
      this.db
        .prepare('SELECT id, operation_type_id, slug, label, color FROM property_statuses ORDER BY id')
        .all(),
    ])

    const operation_types = (opTypesRes.results as any[]).map(r => ({
      id: r.id,
      slug: r.slug,
      label: r.label,
    })) as OperationType[]

    const commercial_stages = (stagesRes.results as any[]).map(r => ({
      id: r.id,
      operation_type_id: r.operation_type_id,
      slug: r.slug,
      label: r.label,
      sort_order: r.sort_order ?? 0,
      is_terminal: Boolean(r.is_terminal),
      color: r.color ?? null,
    })) as CommercialStage[]

    const property_statuses = (statusesRes.results as any[]).map(r => ({
      id: r.id,
      operation_type_id: r.operation_type_id,
      slug: r.slug,
      label: r.label,
      color: r.color ?? null,
    })) as PropertyStatusCatalog[]

    return { operation_types, commercial_stages, property_statuses }
  }

  async markExternalReport(id: string, orgId: string): Promise<void> {
    await this.db
      .prepare(`UPDATE properties SET last_external_report_at = datetime('now') WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .run()
  }

  async clearExternalReport(id: string, orgId: string): Promise<void> {
    await this.db
      .prepare('UPDATE properties SET last_external_report_at = NULL WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .run()
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
      lead_id: row.lead_id ?? null,
      created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
