import type { Webhook } from '../../../domain/entities/webhook'

export interface WebhookRepository {
  save(webhook: Webhook): Promise<void>
  findById(id: string, orgId: string): Promise<Webhook | null>
  findByOrg(orgId: string): Promise<Webhook[]>
  /** Sólo webhooks activos de la org suscriptos al evento. */
  findActiveByEvent(orgId: string, event: string): Promise<Webhook[]>
  delete(id: string, orgId: string): Promise<void>
  touchLastTriggered(id: string): Promise<void>
}

export interface WebhookDeliveryLog {
  id: string
  org_id: string
  webhook_id: string
  event: string
  status: 'success' | 'failed'
  http_status: number | null
  attempts: number
  error: string | null
  created_at?: string
}

export interface WebhookDeliveryRepository {
  log(entry: WebhookDeliveryLog): Promise<void>
  findByWebhook(webhookId: string, orgId: string, limit?: number): Promise<WebhookDeliveryLog[]>
}
