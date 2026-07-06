import type { EmailAudienceRepository, AudienceRecipient, CampaignSegment } from '@vendepro/core'

/**
 * Resuelve segmentos de campaña contra contacts/leads.
 * Garantías del port: solo emails válidos, excluye supresiones,
 * dedup por email (case-insensitive). Todo en SQL para no cargar
 * tablas enteras en memoria.
 */
export class D1EmailAudienceRepository implements EmailAudienceRepository {
  constructor(private readonly db: D1Database) {}

  async resolve(orgId: string, segment: CampaignSegment): Promise<AudienceRecipient[]> {
    if (segment.source === 'contacts') {
      return this.resolveContacts(orgId, segment)
    }
    return this.resolveLeads(orgId, segment)
  }

  private async resolveContacts(orgId: string, segment: CampaignSegment): Promise<AudienceRecipient[]> {
    const params: any[] = [orgId, orgId]
    let where = ''
    if (segment.contact_type) {
      where = 'AND c.contact_type = ?'
      params.push(segment.contact_type)
    }
    const { results } = await this.db.prepare(`
      SELECT
        lower(trim(c.email)) as email,
        MIN(c.full_name) as name,
        MIN(c.id) as contact_id
      FROM contacts c
      WHERE c.org_id = ?
        AND c.email IS NOT NULL AND trim(c.email) != ''
        AND c.email LIKE '%@%'
        AND lower(trim(c.email)) NOT IN (
          SELECT email FROM email_suppressions WHERE org_id = ?
        )
        ${where}
      GROUP BY lower(trim(c.email))
    `).bind(...params).all()
    return (results as any[]).map(r => ({
      email: r.email,
      name: r.name ?? null,
      contact_id: r.contact_id ?? null,
      lead_id: null,
    }))
  }

  private async resolveLeads(orgId: string, segment: CampaignSegment): Promise<AudienceRecipient[]> {
    const params: any[] = [orgId, orgId]
    let where = ''
    const stages = (segment.stages ?? []).filter(Boolean)
    if (stages.length > 0) {
      where = `AND l.stage IN (${stages.map(() => '?').join(',')})`
      params.push(...stages)
    }
    const { results } = await this.db.prepare(`
      SELECT
        lower(trim(l.email)) as email,
        MIN(l.full_name) as name,
        MIN(l.id) as lead_id
      FROM leads l
      WHERE l.org_id = ?
        AND l.email IS NOT NULL AND trim(l.email) != ''
        AND l.email LIKE '%@%'
        AND lower(trim(l.email)) NOT IN (
          SELECT email FROM email_suppressions WHERE org_id = ?
        )
        ${where}
      GROUP BY lower(trim(l.email))
    `).bind(...params).all()
    return (results as any[]).map(r => ({
      email: r.email,
      name: r.name ?? null,
      contact_id: null,
      lead_id: r.lead_id ?? null,
    }))
  }
}
