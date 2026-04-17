import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'

export class RemoveAppraisalComparableUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(comparableId: string): Promise<void> {
    await this.repo.removeComparable(comparableId)
  }
}
