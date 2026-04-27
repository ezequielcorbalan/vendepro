import { describe, it, expect, vi } from 'vitest'
import { GetAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/get-appraisal-template'

describe('GetAppraisalTemplateUseCase', () => {
  it('returns template when org owns it or it is global', async () => {
    const tpl = { id: 't1', org_id: null, toObject: () => ({ id: 't1', org_id: null }) }
    const mockRepo = { findById: vi.fn().mockResolvedValue(tpl), listVisibleTo: vi.fn(), save: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new GetAppraisalTemplateUseCase(mockRepo as any)
    const r = await uc.execute({ id: 't1', orgId: 'o1' })
    expect(r?.id).toBe('t1')
  })

  it('returns null when template belongs to another org', async () => {
    const tpl = { id: 't1', org_id: 'o2', toObject: () => ({ id: 't1', org_id: 'o2' }) }
    const mockRepo = { findById: vi.fn().mockResolvedValue(tpl), listVisibleTo: vi.fn(), save: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new GetAppraisalTemplateUseCase(mockRepo as any)
    const r = await uc.execute({ id: 't1', orgId: 'o1' })
    expect(r).toBeNull()
  })
})
