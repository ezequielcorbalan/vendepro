import type { EmailCampaign, EmailCampaignStatus } from '../../../domain/entities/email-campaign'

export interface EmailCampaignRepository {
  findById(id: string, orgId: string): Promise<EmailCampaign | null>
  listByOrg(orgId: string, limit?: number): Promise<EmailCampaign[]>
  /** Campañas en un estado dado, cross-org (para el cron de envío). */
  listByStatus(status: EmailCampaignStatus, limit?: number): Promise<EmailCampaign[]>
  save(campaign: EmailCampaign): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}

export interface CampaignSendRow {
  id: string
  org_id: string
  campaign_id: string
  email: string
  name: string | null
  contact_id: string | null
  lead_id: string | null
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  error: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  created_at: string
}

export interface EmailCampaignSendRepository {
  /** Inserta destinatarios en la cola. Ignora duplicados (campaign_id, email). */
  insertMany(rows: Array<Omit<CampaignSendRow, 'status' | 'attempts' | 'error' | 'sent_at' | 'opened_at' | 'clicked_at' | 'created_at'>>): Promise<void>
  /** Pendientes de una campaña (attempts < maxAttempts), en orden de creación. */
  listPending(campaignId: string, limit: number, maxAttempts: number): Promise<CampaignSendRow[]>
  countPending(campaignId: string, maxAttempts: number): Promise<number>
  markSent(ids: string[]): Promise<void>
  markFailed(ids: string[], error: string): Promise<void>
  listByCampaign(campaignId: string, orgId: string, limit?: number): Promise<CampaignSendRow[]>
  deleteByCampaign(campaignId: string, orgId: string): Promise<void>
}
