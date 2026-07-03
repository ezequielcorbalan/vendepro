import type { WebhookRepository } from '../../ports/repositories/webhook-repository'
import type { WebhookProps } from '../../../domain/entities/webhook'

export class ListWebhooksUseCase {
  constructor(private readonly repo: WebhookRepository) {}

  async execute(orgId: string): Promise<WebhookProps[]> {
    const webhooks = await this.repo.findByOrg(orgId)
    return webhooks.map((w) => w.toObject())
  }
}
