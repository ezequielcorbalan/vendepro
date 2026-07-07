import type { EmailAutomationRepository } from '../../ports/repositories/email-automation-repository'
import type { AutomationStep } from '../../../domain/entities/email-automation'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdateEmailAutomationInput {
  id: string
  orgId: string
  name?: string
  trigger_event?: string | null
  steps?: AutomationStep[] | null
}

export class UpdateEmailAutomationUseCase {
  constructor(private readonly repo: EmailAutomationRepository) {}

  async execute(input: UpdateEmailAutomationInput): Promise<{ ok: true }> {
    const automation = await this.repo.findById(input.id, input.orgId)
    if (!automation) throw new NotFoundError('Automatización no encontrada')

    automation.update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.trigger_event !== undefined ? { trigger_event: input.trigger_event } : {}),
      ...(input.steps !== undefined ? { steps_json: input.steps ? JSON.stringify(input.steps) : null } : {}),
    })
    await this.repo.save(automation)
    return { ok: true }
  }
}
