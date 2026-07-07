import type {
  EmailAutomationRepository, EmailAutomationEnrollmentRepository, EmailAutomationSendRepository,
} from '../../ports/repositories/email-automation-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export class DeleteEmailAutomationUseCase {
  constructor(
    private readonly repo: EmailAutomationRepository,
    private readonly enrollmentRepo: EmailAutomationEnrollmentRepository,
    private readonly sendRepo: EmailAutomationSendRepository,
  ) {}

  async execute(id: string, orgId: string): Promise<{ ok: true }> {
    const automation = await this.repo.findById(id, orgId)
    if (!automation) throw new NotFoundError('Automatización no encontrada')
    await this.enrollmentRepo.deleteByAutomation(id, orgId)
    await this.sendRepo.deleteByAutomation(id, orgId)
    await this.repo.delete(id, orgId)
    return { ok: true }
  }
}
