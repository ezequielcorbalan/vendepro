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
})
