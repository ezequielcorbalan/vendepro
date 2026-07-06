import type { CampaignSegment } from '../../../domain/entities/email-campaign'

export interface AudienceRecipient {
  email: string
  name: string | null
  contact_id: string | null
  lead_id: string | null
}

/**
 * Resuelve el segmento de una campaña a destinatarios concretos.
 * Reglas que la implementación debe garantizar:
 * - Solo registros con email válido (no null/'')
 * - Excluye emails en email_suppressions de la org
 * - Deduplica por email (case-insensitive)
 */
export interface EmailAudienceRepository {
  resolve(orgId: string, segment: CampaignSegment): Promise<AudienceRecipient[]>
}
