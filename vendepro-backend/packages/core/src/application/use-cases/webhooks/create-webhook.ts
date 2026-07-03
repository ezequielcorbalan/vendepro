import type { WebhookRepository } from '../../ports/repositories/webhook-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Webhook, type WebhookProps } from '../../../domain/entities/webhook'

export interface CreateWebhookInput {
  orgId: string
  name?: string | null
  url: string
  events: string[]
}

export class CreateWebhookUseCase {
  constructor(
    private readonly repo: WebhookRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateWebhookInput): Promise<WebhookProps> {
    // El secret se guarda en claro: hace falta para firmar cada entrega y
    // poder mostrarlo en la UI al configurar el receptor (n8n).
    const secret = `whsec_${this.ids.generate()}${this.ids.generate()}`
    const webhook = Webhook.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      name: input.name ?? null,
      url: input.url,
      secret,
      events: input.events,
      is_active: true,
      last_triggered_at: null,
    })
    await this.repo.save(webhook)
    return webhook.toObject()
  }
}
