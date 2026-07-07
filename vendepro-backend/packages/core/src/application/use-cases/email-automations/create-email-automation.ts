import type { EmailAutomationRepository } from '../../ports/repositories/email-automation-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { EmailAutomation, type AutomationStep } from '../../../domain/entities/email-automation'

export interface CreateEmailAutomationInput {
  orgId: string
  userId: string
  name: string
  trigger_event?: string | null
  steps?: AutomationStep[] | null
}

export class CreateEmailAutomationUseCase {
  constructor(
    private readonly repo: EmailAutomationRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: CreateEmailAutomationInput): Promise<{ id: string }> {
    const automation = EmailAutomation.create({
      id: this.idGenerator.generate(),
      org_id: input.orgId,
      name: input.name,
      trigger_event: input.trigger_event ?? null,
      steps_json: input.steps ? JSON.stringify(input.steps) : null,
      created_by: input.userId,
    })
    await this.repo.save(automation)
    return { id: automation.id }
  }
}
