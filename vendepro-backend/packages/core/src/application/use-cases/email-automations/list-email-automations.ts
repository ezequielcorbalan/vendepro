import type { EmailAutomationRepository, EmailAutomationEnrollmentRepository } from '../../ports/repositories/email-automation-repository'
import type { EmailAutomationProps } from '../../../domain/entities/email-automation'

export interface AutomationListItem extends EmailAutomationProps {
  step_count: number
  active_enrollments: number
}

export class ListEmailAutomationsUseCase {
  constructor(
    private readonly repo: EmailAutomationRepository,
    private readonly enrollmentRepo: EmailAutomationEnrollmentRepository,
  ) {}

  async execute(orgId: string, limit = 50): Promise<AutomationListItem[]> {
    const automations = await this.repo.listByOrg(orgId, limit)
    return Promise.all(automations.map(async a => {
      const counts = await this.enrollmentRepo.countByStatus(a.id, orgId)
      return {
        ...a.toObject(),
        step_count: a.steps.length,
        active_enrollments: counts.active ?? 0,
      }
    }))
  }
}
