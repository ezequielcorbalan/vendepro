import { describe, it, expect, vi } from 'vitest'
import { CreateAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/create-appraisal-template'

describe('CreateAppraisalTemplateUseCase', () => {
  it('creates an empty custom template for an org', async () => {
    const mockRepo = { save: vi.fn().mockResolvedValue(undefined), findById: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const mockIdGen = { generate: vi.fn().mockReturnValue('t-new') }
    const uc = new CreateAppraisalTemplateUseCase(mockRepo as any, mockIdGen)
    const r = await uc.execute({ orgId: 'o1', name: 'Mi Casa', kind: 'casa', blocks: [] })
    expect(r.id).toBe('t-new'); expect(mockRepo.save).toHaveBeenCalled()
  })
})
