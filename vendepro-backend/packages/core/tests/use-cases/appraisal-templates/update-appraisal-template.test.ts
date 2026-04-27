import { describe, it, expect, vi } from 'vitest'
import { UpdateAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/update-appraisal-template'
import { AppraisalTemplate } from '@vendepro/core'

const tpl = AppraisalTemplate.create({
  id: 't1', org_id: 'o1', kind: 'casa', name: 'Old', description: null,
  preview_image_url: null, blocks: [], is_system: false, parent_template_id: null,
  active: true, sort_order: 0,
})

describe('UpdateAppraisalTemplateUseCase', () => {
  it('updates name and blocks of an org template', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(tpl), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new UpdateAppraisalTemplateUseCase(repo as any)
    const r = await uc.execute({ id: 't1', orgId: 'o1', name: 'New', blocks: [] })
    expect(r.updated).toBe(true)
    expect(repo.save).toHaveBeenCalled()
  })

  it('rejects editing a system template directly', async () => {
    const sys = AppraisalTemplate.create({
      id: 'sys', org_id: null, kind: 'casa', name: 'Sys', description: null,
      preview_image_url: null, blocks: [], is_system: true, parent_template_id: null,
      active: true, sort_order: 0,
    })
    const repo = { findById: vi.fn().mockResolvedValue(sys), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new UpdateAppraisalTemplateUseCase(repo as any)
    await expect(uc.execute({ id: 'sys', orgId: 'o1', name: 'X' })).rejects.toThrow(/sistema/i)
  })
})
