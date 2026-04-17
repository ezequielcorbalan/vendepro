import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'

export class DeleteAppraisalUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    await this.repo.delete(id, orgId)
  }
}
