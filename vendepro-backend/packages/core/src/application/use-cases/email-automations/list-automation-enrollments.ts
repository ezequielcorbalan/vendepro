import type { EmailAutomationEnrollmentRepository, EnrollmentRow } from '../../ports/repositories/email-automation-repository'

export class ListAutomationEnrollmentsUseCase {
  constructor(private readonly repo: EmailAutomationEnrollmentRepository) {}

  async execute(automationId: string, orgId: string, limit = 200): Promise<EnrollmentRow[]> {
    return this.repo.listByAutomation(automationId, orgId, limit)
  }
}
