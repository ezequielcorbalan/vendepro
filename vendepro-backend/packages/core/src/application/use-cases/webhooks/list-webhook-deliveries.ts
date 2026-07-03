import type { WebhookDeliveryRepository, WebhookDeliveryLog } from '../../ports/repositories/webhook-repository'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface ListWebhookDeliveriesInput {
  webhookId: string
  orgId: string
  limit?: number
}

export class ListWebhookDeliveriesUseCase {
  constructor(private readonly deliveries: WebhookDeliveryRepository) {}

  async execute(input: ListWebhookDeliveriesInput): Promise<WebhookDeliveryLog[]> {
    if (!input.webhookId) throw new ValidationError('webhookId requerido')
    return this.deliveries.findByWebhook(input.webhookId, input.orgId, input.limit ?? 20)
  }
}
