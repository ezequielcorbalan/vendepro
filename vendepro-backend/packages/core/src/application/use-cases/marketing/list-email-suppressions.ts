import type { EmailSuppressionRepository } from '../../ports/repositories/email-suppression-repository'
import type { EmailSuppression } from '../../../domain/entities/email-suppression'

export class ListEmailSuppressionsUseCase {
  constructor(private readonly repo: EmailSuppressionRepository) {}

  async execute(orgId: string, limit = 100): Promise<EmailSuppression[]> {
    return this.repo.listByOrg(orgId, limit)
  }
}
