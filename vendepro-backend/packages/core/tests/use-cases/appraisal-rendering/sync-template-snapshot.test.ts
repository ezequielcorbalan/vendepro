import { describe, it, expect, vi } from 'vitest'
import { SyncTemplateSnapshotUseCase } from '../../../src/application/use-cases/appraisal-rendering/sync-template-snapshot'
import { AppraisalTemplate } from '@vendepro/core'

const tpl = AppraisalTemplate.create({
  id: 't1', org_id: 'o1', kind: 'casa', name: 'TT', description: null,
  preview_image_url: null, blocks: [{ id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { title: 'NEW' } } as any],
  is_system: false, parent_template_id: null, active: true, sort_order: 0,
})

describe('SyncTemplateSnapshotUseCase', () => {
  it('refreshes snapshot preserving overrides', async () => {
    const appraisal = {
      id: 'a1', org_id: 'o1', template_id: 't1',
      template_snapshot_json: [{ id: 'b1', data: { title: 'OLD' } }],
      block_overrides_json: { b1: { subtitle: 'kept' } },
      toObject: () => ({ id: 'a1', org_id: 'o1', template_id: 't1' }),
    }
    const appraisalRepo = {
      findById: vi.fn().mockResolvedValue(appraisal),
      update: vi.fn().mockResolvedValue(undefined),
    }
    const tplRepo = { findById: vi.fn().mockResolvedValue(tpl), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new SyncTemplateSnapshotUseCase(appraisalRepo as any, tplRepo as any)
    const r = await uc.execute({ appraisalId: 'a1', orgId: 'o1' })
    expect(r.synced).toBe(true)
    expect(appraisalRepo.update).toHaveBeenCalled()
  })
})
