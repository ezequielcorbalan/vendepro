import { describe, it, expect, vi } from 'vitest'
import { SetBlockOverridesUseCase } from '../../../src/application/use-cases/appraisal-rendering/set-block-overrides'

describe('SetBlockOverridesUseCase', () => {
  it('merges partial override for a block', async () => {
    const appraisalRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'a1', org_id: 'o1', block_overrides_json: { b1: { a: 1 } } }),
      update: vi.fn().mockResolvedValue(undefined),
    }
    const uc = new SetBlockOverridesUseCase(appraisalRepo as any)
    await uc.execute({ appraisalId: 'a1', orgId: 'o1', blockId: 'b1', patch: { b: 2 } })
    const call = appraisalRepo.update.mock.calls[0][2]
    expect(call.block_overrides_json).toMatch(/"b1":\{"a":1,"b":2\}/)
  })
})
