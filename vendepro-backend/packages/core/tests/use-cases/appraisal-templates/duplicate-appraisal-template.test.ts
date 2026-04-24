import { describe, it, expect, vi } from 'vitest'
import { DuplicateAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/duplicate-appraisal-template'
import { AppraisalTemplate } from '@vendepro/core'

const sys = AppraisalTemplate.create({
  id: 'sys1', org_id: null, kind: 'casa', name: 'Sys', description: null,
  preview_image_url: null, blocks: [], is_system: true, parent_template_id: null,
  active: true, sort_order: 0,
})

describe('DuplicateAppraisalTemplateUseCase', () => {
  it('copies system template to org-owned custom', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(sys), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const idGen = { generate: vi.fn().mockReturnValue('new-id') }
    const uc = new DuplicateAppraisalTemplateUseCase(repo as any, idGen)
    const r = await uc.execute({ sourceId: 'sys1', orgId: 'o1' })
    expect(r.id).toBe('new-id'); expect(repo.save).toHaveBeenCalled()
  })
})
