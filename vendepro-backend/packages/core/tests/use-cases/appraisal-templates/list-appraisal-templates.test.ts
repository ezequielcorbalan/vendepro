import { describe, it, expect, vi } from 'vitest'
import { ListAppraisalTemplatesUseCase } from '../../../src/application/use-cases/appraisal-templates/list-appraisal-templates'

describe('ListAppraisalTemplatesUseCase', () => {
  it('returns templates for the given org', async () => {
    const mockRepo = {
      listVisibleTo: vi.fn().mockResolvedValue([
        { id: 't1', toObject: () => ({ id: 't1', name: 'Sys' }) },
      ]),
      findById: vi.fn(), save: vi.fn(), countUsingTemplate: vi.fn(),
    }
    const uc = new ListAppraisalTemplatesUseCase(mockRepo as any)
    const res = await uc.execute({ orgId: 'o1', onlyActive: true })
    expect(res.length).toBe(1)
    expect(mockRepo.listVisibleTo).toHaveBeenCalledWith('o1', { onlyActive: true, kind: undefined })
  })
})
