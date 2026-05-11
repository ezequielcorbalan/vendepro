import { describe, it, expect, vi } from 'vitest'
import { CreateAppraisalUseCase } from '../../../src/application/use-cases/appraisals/create-appraisal'

const mockRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), delete: vi.fn(),
  countByOrg: vi.fn(), countByOrgAndStage: vi.fn(), countByAgent: vi.fn(),
  findComparables: vi.fn(), addComparable: vi.fn(), removeComparable: vi.fn(), update: vi.fn(),
  findPublicByIdOrSlugWithOrg: vi.fn(),
}
const mockIdGen = { generate: vi.fn().mockReturnValue('appraisal-id-1') }

describe('CreateAppraisalUseCase', () => {
  it('creates appraisal and returns id and status', async () => {
    const useCase = new CreateAppraisalUseCase(mockRepo as any, mockIdGen)
    const result = await useCase.execute({
      org_id: 'org-1',
      agent_id: 'agent-1',
      property_address: 'Av. Corrientes 1234',
      neighborhood: 'Palermo',
    })
    expect(result.id).toBe('appraisal-id-1')
    expect(result.status).toBe('draft')
    expect(mockRepo.save).toHaveBeenCalled()
  })

  it('throws ValidationError for missing property_address', async () => {
    const useCase = new CreateAppraisalUseCase(mockRepo as any, mockIdGen)
    await expect(useCase.execute({
      org_id: 'org-1',
      agent_id: 'agent-1',
      property_address: '',
    })).rejects.toThrow()
  })

  it('takes snapshot when template_id is provided', async () => {
    const tplRepo = { findById: vi.fn().mockResolvedValue({ org_id: 'org-1', blocks: [{ id: 'b1', type: 'cover' }] }) }
    const uc = new CreateAppraisalUseCase(mockRepo as any, mockIdGen, tplRepo as any)
    const result = await uc.execute({ org_id: 'org-1', agent_id: 'a1', property_address: 'Addr X', template_id: 't1' })
    expect(result.id).toBe('appraisal-id-1')
    expect(tplRepo.findById).toHaveBeenCalledWith('t1')
    expect(mockRepo.save).toHaveBeenCalled()
  })

  it('accepts custom snapshot when template_id is null (from-scratch mode)', async () => {
    const saveSpy = vi.fn().mockResolvedValue(undefined)
    const repo = { ...mockRepo, save: saveSpy }
    const uc = new CreateAppraisalUseCase(repo as any, mockIdGen)
    await uc.execute({
      org_id: 'org-1',
      agent_id: 'a1',
      property_address: 'Addr Z',
      template_snapshot_json: [
        { type: 'cover', data: { title: 'Hola' } },
        { id: 'custom-foda', type: 'swot', binding_mode: 'tasacion', include_in_pdf: false, sort_order: 1, data: {} },
      ],
    })
    const saved = saveSpy.mock.calls[0][0]
    const snap = saved.template_snapshot_json
    expect(Array.isArray(snap)).toBe(true)
    expect(snap).toHaveLength(2)
    expect(snap[0].type).toBe('cover')
    expect(snap[0].binding_mode).toBe('tasacion')
    expect(snap[0].include_in_pdf).toBe(true)
    expect(snap[0].sort_order).toBe(0)
    expect(snap[0].id).toBe('custom-cover-0')
    expect(snap[0].data).toEqual({ title: 'Hola' })
    expect(snap[1].id).toBe('custom-foda')
    expect(snap[1].include_in_pdf).toBe(false)
    expect(saved.template_synced_at).toBeNull()
  })

  it('rejects non-array template_snapshot_json', async () => {
    const uc = new CreateAppraisalUseCase(mockRepo as any, mockIdGen)
    await expect(uc.execute({
      org_id: 'org-1', agent_id: 'a1', property_address: 'X',
      template_snapshot_json: { not: 'array' } as any,
    })).rejects.toThrow()
  })

  it('ignores template_snapshot_json when template_id is provided', async () => {
    const tplRepo = { findById: vi.fn().mockResolvedValue({ org_id: 'org-1', blocks: [{ id: 'b1', type: 'cover' }] }) }
    const saveSpy = vi.fn().mockResolvedValue(undefined)
    const repo = { ...mockRepo, save: saveSpy }
    const uc = new CreateAppraisalUseCase(repo as any, mockIdGen, tplRepo as any)
    await uc.execute({
      org_id: 'org-1', agent_id: 'a1', property_address: 'X',
      template_id: 't1',
      template_snapshot_json: [{ type: 'cover', data: {} }],
    })
    const saved = saveSpy.mock.calls[0][0]
    // El snapshot tomado debe ser el del template, no el custom
    expect(saved.template_snapshot_json).toEqual([{ id: 'b1', type: 'cover' }])
    expect(saved.template_synced_at).not.toBeNull()
  })
})
