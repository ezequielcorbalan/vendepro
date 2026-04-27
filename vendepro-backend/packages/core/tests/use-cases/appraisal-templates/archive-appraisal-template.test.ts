import { describe, it, expect, vi } from 'vitest'
import { ArchiveAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/archive-appraisal-template'
import { AppraisalTemplate } from '@vendepro/core'

const tpl = AppraisalTemplate.create({
  id: 't1', org_id: 'o1', kind: 'casa', name: 'Mi Template', description: null,
  preview_image_url: null, blocks: [], is_system: false, parent_template_id: null,
  active: true, sort_order: 0,
})

describe('ArchiveAppraisalTemplateUseCase', () => {
  it('archives a custom template', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(tpl), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn().mockResolvedValue(0) }
    const uc = new ArchiveAppraisalTemplateUseCase(repo as any)
    const r = await uc.execute({ id: 't1', orgId: 'o1' })
    expect(r.archived).toBe(true)
  })

  it('can archive a template with legacy blocks that no longer pass validation', async () => {
    // Simulates a template stored before the schema was tightened — e.g., a
    // comparables_list block missing the now-required `variant` field. Archive
    // should not require re-validation since it only flips `active`.
    const legacy = AppraisalTemplate.fromPersistence({
      id: 't-legacy', org_id: 'o1', kind: 'casa', name: 'Legacy', description: null,
      preview_image_url: null,
      blocks: [
        { id: 'b1', type: 'comparables_list', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: {} } as any,
      ],
      is_system: false, parent_template_id: null, active: true, sort_order: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    const repo = {
      findById: vi.fn().mockResolvedValue(legacy),
      save: vi.fn(),
      listVisibleTo: vi.fn(),
      countUsingTemplate: vi.fn().mockResolvedValue(0),
    }
    const uc = new ArchiveAppraisalTemplateUseCase(repo as any)
    const r = await uc.execute({ id: 't-legacy', orgId: 'o1' })
    expect(r.archived).toBe(true)
    expect(repo.save).toHaveBeenCalledOnce()
    const saved = (repo.save.mock.calls[0][0] as AppraisalTemplate).toObject()
    expect(saved.active).toBe(false)
  })
})
