import type { WebhookRepository } from '../../ports/repositories/webhook-repository'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface DeleteWebhookInput {
  id: string
  orgId: string
}

export class DeleteWebhookUseCase {
  constructor(private readonly repo: WebhookRepository) {}

  async execute(input: DeleteWebhookInput): Promise<{ success: true }> {
    if (!input.id) throw new ValidationError('id de webhook requerido')
    await this.repo.delete(input.id, input.orgId)
    return { success: true }
  }
}
