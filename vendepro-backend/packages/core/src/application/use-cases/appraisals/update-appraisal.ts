import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'

export class UpdateAppraisalUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(id: string, orgId: string, patch: Record<string, unknown>): Promise<void> {
    const existing = await this.repo.findById(id, orgId)
    if (!existing) {
      const err = new Error('Appraisal not found')
      ;(err as any).statusCode = 404
      throw err
    }
    await this.repo.update(id, orgId, patch)
  }
}
