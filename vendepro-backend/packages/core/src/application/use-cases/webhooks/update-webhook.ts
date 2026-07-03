import type { WebhookRepository } from '../../ports/repositories/webhook-repository'
import type { WebhookProps } from '../../../domain/entities/webhook'
import { ValidationError } from '../../../domain/errors/validation-error'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdateWebhookInput {
  id: string
  orgId: string
  name?: string | null
  url?: string
  events?: string[]
  is_active?: boolean
}

export class UpdateWebhookUseCase {
  constructor(private readonly repo: WebhookRepository) {}

  async execute(input: UpdateWebhookInput): Promise<WebhookProps> {
    if (!input.id) throw new ValidationError('id de webhook requerido')
    const existing = await this.repo.findById(input.id, input.orgId)
    if (!existing) throw new NotFoundError('Webhook', input.id)
    const updated = existing.update({
      name: input.name,
      url: input.url,
      events: input.events,
      is_active: input.is_active,
    })
    await this.repo.save(updated)
    return updated.toObject()
  }
}
