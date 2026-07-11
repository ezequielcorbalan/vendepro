import { LeadProperty } from '@vendepro/core'
import type { LeadPropertyRepository, InterestedLeadRow, LeadPropertyWithProperty } from '@vendepro/core'

export class D1LeadPropertyRepository implements LeadPropertyRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<LeadProperty | null> {
    const row = await this.db
      .prepare('SELECT * FROM lead_properties WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByLead(leadId: string, orgId: string): Promise<LeadProperty[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM lead_properties WHERE lead_id = ? AND org_id = ? ORDER BY updated_at DESC')
      .bind(leadId, orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findByLeadAndProperty(leadId: string, propertyId: string, orgId: string): Promise<LeadProperty | null> {
    const row = await this.db
      .prepare('SELECT * FROM lead_properties WHERE lead_id = ? AND property_id = ? AND org_id = ?')
      .bind(leadId, propertyId, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByLeadWithProperty(leadId: string, orgId: string): Promise<LeadPropertyWithProperty[]> {
    const rows = (await this.db
      .prepare(`
        SELECT lp.*, p.address as property_address, p.neighborhood as property_neighborhood,
               p.cover_photo as property_cover_photo, p.asking_price as property_asking_price,
               p.currency as property_currency, COALESCE(p.source, 'manual') as property_source
        FROM lead_properties lp
        JOIN properties p ON lp.property_id = p.id
        WHERE lp.lead_id = ? AND lp.org_id = ?
        ORDER BY lp.updated_at DESC
      `)
      .bind(leadId, orgId)
      .all()).results as any[]
    return rows.map(r => ({
      id: r.id,
      lead_id: r.lead_id,
      property_id: r.property_id,
      status: r.status,
      notes: r.notes ?? null,
      feedback: r.feedback ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      property_address: r.property_address,
      property_neighborhood: r.property_neighborhood,
      property_cover_photo: r.property_cover_photo ?? null,
      property_asking_price: r.property_asking_price ?? null,
      property_currency: r.property_currency ?? null,
      property_source: r.property_source ?? 'manual',
    }))
  }

  async findInterestedByProperty(propertyId: string, orgId: string): Promise<InterestedLeadRow[]> {
    const rows = (await this.db
      .prepare(`
        SELECT lp.*, l.full_name as lead_full_name, l.stage as lead_stage,
               COALESCE(l.pipeline, 'vendedor') as lead_pipeline, l.phone as lead_phone,
               l.assigned_to as lead_assigned_to, u.full_name as lead_assigned_name
        FROM lead_properties lp
        JOIN leads l ON lp.lead_id = l.id
        LEFT JOIN users u ON l.assigned_to = u.id
        WHERE lp.property_id = ? AND lp.org_id = ?
        ORDER BY lp.updated_at DESC
      `)
      .bind(propertyId, orgId)
      .all()).results as any[]
    return rows.map(r => ({
      id: r.id,
      lead_id: r.lead_id,
      property_id: r.property_id,
      status: r.status,
      notes: r.notes ?? null,
      feedback: r.feedback ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      lead_full_name: r.lead_full_name,
      lead_stage: r.lead_stage,
      lead_pipeline: r.lead_pipeline,
      lead_phone: r.lead_phone ?? null,
      lead_assigned_to: r.lead_assigned_to ?? null,
      lead_assigned_name: r.lead_assigned_name ?? null,
    }))
  }

  async save(leadProperty: LeadProperty): Promise<void> {
    const o = leadProperty.toObject()
    await this.db.prepare(`
      INSERT INTO lead_properties (id, org_id, lead_id, property_id, status, notes, feedback, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, notes=excluded.notes, feedback=excluded.feedback,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.lead_id, o.property_id, o.status,
      o.notes, o.feedback, o.created_at, o.updated_at,
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM lead_properties WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): LeadProperty {
    return LeadProperty.create({
      id: row.id,
      org_id: row.org_id,
      lead_id: row.lead_id,
      property_id: row.property_id,
      status: row.status,
      notes: row.notes ?? null,
      feedback: row.feedback ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
