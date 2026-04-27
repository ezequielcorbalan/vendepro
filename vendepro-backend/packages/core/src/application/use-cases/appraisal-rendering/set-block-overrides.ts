import { ValidationError } from '@vendepro/core'
import type { AppraisalRepository } from '@vendepro/core'

export class SetBlockOverridesUseCase {
  constructor(private readonly repo: AppraisalRepository) {}
  async execute(input: { appraisalId: string; orgId: string; blockId: string; patch: Record<string, unknown> }): Promise<void> {
    const ap = await this.repo.findById(input.appraisalId, input.orgId)
    if (!ap) throw new ValidationError('Tasación no encontrada')
    const current = (ap as any).block_overrides_json ?? {}
    const existing = current[input.blockId] ?? {}
    const next = { ...current, [input.blockId]: { ...existing, ...input.patch } }
    await this.repo.update(input.appraisalId, input.orgId, { block_overrides_json: JSON.stringify(next) })
  }
}
