import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'

export interface UpdateAppraisalInput {
  [key: string]: unknown
  block_overrides_json?: Record<string, Record<string, unknown>> | null
}

export class UpdateAppraisalUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(id: string, orgId: string, input: UpdateAppraisalInput): Promise<void> {
    const existing = await this.repo.findById(id, orgId)
    if (!existing) {
      const err = new Error('Appraisal not found')
      ;(err as any).statusCode = 404
      throw err
    }
    const patch: Record<string, unknown> = { ...input }
    if (input.block_overrides_json !== undefined) {
      patch.block_overrides_json = JSON.stringify(input.block_overrides_json ?? null)
    }
    await this.repo.update(id, orgId, patch)
  }
}
