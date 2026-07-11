import { Property } from '@vendepro/core'
import type { PropertyRepository, PropertyFilters, PropertyProps, PropertyPhoto, OperationType, CommercialStage, PropertyStatusCatalog, PropertyPriceHistoryEntry } from '@vendepro/core'

/** lower/trim, sin acentos, sin puntuación y con espacios colapsados — para match de direcciones. */
function normalizeAddress(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class D1PropertyRepository implements PropertyRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Property | null> {
    const row = await this.db
      .prepare(`SELECT p.*, u.full_name as agent_name, (SELECT MAX(published_at) FROM reports WHERE property_id = p.id AND status = 'published') as last_report_at FROM properties p LEFT JOIN users u ON p.agent_id = u.id WHERE p.id = ? AND p.org_id = ?`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByLeadId(leadId: string, orgId: string): Promise<{ id: string; commercial_stage: string | null } | null> {
    const row = await this.db
      .prepare('SELECT id, commercial_stage FROM properties WHERE lead_id = ? AND org_id = ? LIMIT 1')
      .bind(leadId, orgId)
      .first<{ id: string; commercial_stage: string | null }>()
    return row ?? null
  }

  async findBySlug(slug: string): Promise<Property | null> {
    const row = await this.db
      .prepare(`SELECT p.*, u.full_name as agent_name, (SELECT MAX(published_at) FROM reports WHERE property_id = p.id AND status = 'published') as last_report_at FROM properties p LEFT JOIN users u ON p.agent_id = u.id WHERE p.public_slug = ?`)
      .bind(slug)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: PropertyFilters): Promise<Property[]> {
    let query = `SELECT p.*, u.full_name as agent_name, (SELECT MAX(published_at) FROM reports WHERE property_id = p.id AND status = 'published') as last_report_at FROM properties p LEFT JOIN users u ON p.agent_id = u.id WHERE p.org_id = ?`
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
        agent_id, status, source, commercial_stage, operation_type,
        operation_type_id, commercial_stage_id, status_id,
        lead_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
      o.status, o.source ?? 'manual', o.commercial_stage, o.operation_type ?? 'venta',
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

  async findPhotoById(photoId: string, orgId: string): Promise<PropertyPhoto | null> {
    const row = await this.db
      .prepare('SELECT * FROM property_photos WHERE id = ? AND org_id = ?')
      .bind(photoId, orgId)
      .first() as any
    if (!row) return null
    return {
      id: row.id,
      property_id: row.property_id,
      org_id: row.org_id,
      url: row.url,
      r2_key: row.r2_key,
      sort_order: row.sort_order ?? 0,
      created_at: row.created_at,
    }
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
      if (propertyId) {
        await this.db
          .prepare('UPDATE property_photos SET sort_order = ? WHERE id = ? AND property_id = ? AND org_id = ?')
          .bind(item.sort_order, item.id, propertyId, orgId)
          .run()
      } else {
        await this.db
          .prepare('UPDATE property_photos SET sort_order = ? WHERE id = ? AND org_id = ?')
          .bind(item.sort_order, item.id, orgId)
          .run()
      }
    }
  }

  async update(id: string, orgId: string, patch: Partial<PropertyProps>): Promise<void> {
    // Build SQL dynamically to avoid referencing columns that may not yet exist
    // in older DB instances (e.g. auth_start_date, doc_status_json from later migrations).
    const COLUMN_MAP: Array<[keyof PropertyProps, string]> = [
      ['address', 'address'],
      ['neighborhood', 'neighborhood'],
      ['city', 'city'],
      ['property_type', 'property_type'],
      ['rooms', 'rooms'],
      ['size_m2', 'size_m2'],
      ['asking_price', 'asking_price'],
      ['currency', 'currency'],
      ['owner_name', 'owner_name'],
      ['owner_phone', 'owner_phone'],
      ['owner_email', 'owner_email'],
      ['contact_id', 'contact_id'],
      ['status', 'status'],
      ['commercial_stage', 'commercial_stage'],
      ['commercial_stage_id', 'commercial_stage_id'],
      ['operation_type', 'operation_type'],
      ['operation_type_id', 'operation_type_id'],
      ['status_id', 'status_id'],
      ['auth_start_date', 'auth_start_date'],
      ['auth_duration_days', 'auth_duration_days'],
      ['doc_status_json', 'doc_status_json'],
      ['agent_id', 'agent_id'],
    ]

    // Sanea las columnas con FK antes de escribir. Un valor huérfano
    // (p.ej. agent_id de un agente que luego fue borrado) haría fallar el
    // UPDATE con "FOREIGN KEY constraint failed" y bloquearía una edición
    // por lo demás válida. Una propiedad puede no tener agente: si el agente
    // recibido es vacío o ya no existe, lo dejamos en NULL (sin asignar).
    const safePatch: Partial<PropertyProps> = { ...patch }
    if ('agent_id' in safePatch) {
      const aid = safePatch.agent_id
      if (aid == null || aid === '') {
        safePatch.agent_id = null
      } else {
        const ok = await this.db.prepare('SELECT 1 FROM users WHERE id = ? LIMIT 1').bind(aid).first()
        if (!ok) safePatch.agent_id = null
      }
    }
    if ('contact_id' in safePatch && safePatch.contact_id != null) {
      const ok = await this.db.prepare('SELECT 1 FROM contacts WHERE id = ? LIMIT 1').bind(safePatch.contact_id).first()
      if (!ok) safePatch.contact_id = null
    }

    const setClauses: string[] = []
    const bindings: unknown[] = []

    for (const [field, col] of COLUMN_MAP) {
      if (!(field in safePatch)) continue
      const val = safePatch[field]
      setClauses.push(`${col} = ?`)
      bindings.push(val ?? null)
    }

    if (setClauses.length === 0) return

    setClauses.push(`updated_at = datetime('now')`)
    bindings.push(id, orgId)

    try {
      await this.db
        .prepare(`UPDATE properties SET ${setClauses.join(', ')} WHERE id = ? AND org_id = ?`)
        .bind(...(bindings as any[]))
        .run()
    } catch (e: any) {
      // Nunca propagamos el mensaje crudo de D1 hacia arriba (lo terminaría
      // viendo el usuario). Lo traducimos a un error de dominio limpio.
      const msg = String(e?.message ?? '')
      if (/FOREIGN KEY|constraint|SQLITE/i.test(msg)) {
        throw new Error('No se pudo guardar la propiedad: hay un dato vinculado (agente o contacto) que ya no existe.')
      }
      throw new Error('No se pudo guardar la propiedad.')
    }
  }

  async findStageSlugById(stageId: number): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT slug FROM commercial_stages WHERE id = ?')
      .bind(stageId)
      .first<{ slug: string }>()
    return row?.slug ?? null
  }

  async updateStage(id: string, orgId: string, stageSlug: string): Promise<void> {
    // Try matching by operation_type_id first, fall back to slug-only lookup
    let stageRow = await this.db
      .prepare(`
        SELECT cs.id as stage_id, cs.slug as stage_slug
        FROM commercial_stages cs
        JOIN properties p ON cs.operation_type_id = p.operation_type_id
        WHERE p.id = ? AND cs.slug = ?
      `)
      .bind(id, stageSlug)
      .first() as any

    if (!stageRow) {
      // Fallback: property may lack operation_type_id — match slug across all operation types
      stageRow = await this.db
        .prepare(`SELECT id as stage_id, slug as stage_slug FROM commercial_stages WHERE slug = ? LIMIT 1`)
        .bind(stageSlug)
        .first() as any
    }

    if (!stageRow) throw new Error(`invalid stage: ${stageSlug}`)

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

  async searchByAddress(orgId: string, query: string, limit: number): Promise<Array<{ id: string; address: string }>> {
    const rows = (await this.db
      .prepare(`SELECT id, address FROM properties WHERE org_id = ? AND address LIKE ? LIMIT ?`)
      .bind(orgId, `%${query}%`, limit)
      .all()).results as any[]
    return rows.map(r => ({ id: r.id, address: r.address }))
  }

  async findByNormalizedAddress(orgId: string, address: string): Promise<Property | null> {
    const normalized = normalizeAddress(address)
    if (!normalized) return null
    // Candidatos por LIKE con el primer token (aprovecha el filtro SQL) y match
    // exacto normalizado en memoria — el volumen por org es chico (LIMIT 200 en listados).
    const rows = (await this.db
      .prepare('SELECT p.* FROM properties p WHERE p.org_id = ? LIMIT 500')
      .bind(orgId)
      .all()).results as any[]
    const match = rows.find(r => normalizeAddress(String(r.address ?? '')) === normalized)
    return match ? this.toEntity(match) : null
  }

  async addPriceHistory(entry: PropertyPriceHistoryEntry): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO property_price_history (id, property_id, org_id, price_usd, previous_price_usd, reason, changed_by, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        entry.id,
        entry.property_id,
        entry.org_id,
        entry.price_usd,
        entry.previous_price_usd ?? null,
        entry.reason ?? null,
        entry.changed_by ?? null,
        entry.changed_at,
      )
      .run()
  }

  async findPriceHistory(propertyId: string, orgId: string): Promise<PropertyPriceHistoryEntry[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM property_price_history WHERE property_id = ? AND org_id = ? ORDER BY changed_at DESC')
      .bind(propertyId, orgId)
      .all()).results as any[]
    return rows.map(r => ({
      id: r.id,
      property_id: r.property_id,
      org_id: r.org_id,
      price_usd: Number(r.price_usd),
      previous_price_usd: r.previous_price_usd != null ? Number(r.previous_price_usd) : null,
      reason: r.reason ?? null,
      changed_by: r.changed_by ?? null,
      changed_at: r.changed_at,
    }))
  }

  async findByPublicSlug(slug: string): Promise<Property | null> {
    const row = await this.db
      .prepare(`SELECT p.*, u.full_name as agent_name, (SELECT MAX(published_at) FROM reports WHERE property_id = p.id AND status = 'published') as last_report_at FROM properties p LEFT JOIN users u ON p.agent_id = u.id WHERE p.public_slug = ?`)
      .bind(slug)
      .first() as any
    return row ? this.toEntity(row) : null
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
      source: row.source === 'kiteprop' ? 'kiteprop' : 'manual',
      commercial_stage: row.commercial_stage ?? null,
      operation_type: row.operation_type ?? 'venta',
      operation_type_id: row.operation_type_id ?? 1,
      commercial_stage_id: row.commercial_stage_id ?? null,
      status_id: row.status_id ?? 1,
      lead_id: row.lead_id ?? null,
      auth_start_date: row.auth_start_date ?? null,
      auth_duration_days: row.auth_duration_days ?? null,
      doc_status_json: row.doc_status_json ?? null,
      created_at: row.created_at, updated_at: row.updated_at,
      // Computed / joined fields surfaced to API consumers (frontend
      // PropertyFilters reads both to compute "sin reportar" alert).
      agent_name: row.agent_name ?? undefined,
      last_external_report_at: row.last_external_report_at ?? null,
      last_report_at: row.last_report_at ?? null,
    })
  }
}
