import type {
  EmailAutomationRepository, EmailAutomationEnrollmentRepository, EmailAutomationSendRepository,
} from '../../ports/repositories/email-automation-repository'
import type { EmailAutomationProps } from '../../../domain/entities/email-automation'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface GetAutomationResult extends EmailAutomationProps {
  enrollment_counts: Record<string, number>
  sends: { sent: number; failed: number }
}

export class GetEmailAutomationUseCase {
  constructor(
    private readonly repo: EmailAutomationRepository,
    private readonly enrollmentRepo: EmailAutomationEnrollmentRepository,
    private readonly sendRepo: EmailAutomationSendRepository,
  ) {}

  async execute(id: string, orgId: string): Promise<GetAutomationResult> {
    const automation = await this.repo.findById(id, orgId)
    if (!automation) throw new NotFoundError('Automatización no encontrada')
    const [counts, sends] = await Promise.all([
      this.enrollmentRepo.countByStatus(id, orgId),
      this.sendRepo.countByAutomation(id, orgId),
    ])
    return { ...automation.toObject(), enrollment_counts: counts, sends }
  }
}
