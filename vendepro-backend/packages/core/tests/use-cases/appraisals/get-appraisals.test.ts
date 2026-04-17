import { describe, it, expect, vi } from 'vitest'
import { GetAppraisalsUseCase } from '../../../src/application/use-cases/appraisals/get-appraisals'

const mockAppraisal = { id: 'app-1', toObject: () => ({ id: 'app-1', status: 'draft' }) }

const mockRepo = {
  findByOrg: vi.fn().mockResolvedValue([mockAppraisal]),
  findById: vi.fn(), findBySlug: vi.fn(), save: vi.fn(), delete: vi.fn(),
  countByOrg: vi.fn(), countByOrgAndStage: vi.fn(), countByAgent: vi.fn(),
  findComparables: vi.fn(), addComparable: vi.fn(), removeComparable: vi.fn(), update: vi.fn(),
  findPublicByIdOrSlugWithOrg: vi.fn(),
}

describe('GetAppraisalsUseCase', () => {
  it('returns appraisals for org', async () => {
    const useCase = new GetAppraisalsUseCase(mockRepo as any)
    const result = await useCase.execute('org-1')
    expect(result).toHaveLength(1)
    expect(mockRepo.findByOrg).toHaveBeenCalledWith('org-1', {})
  })

  it('passes filters to repo', async () => {
    const useCase = new GetAppraisalsUseCase(mockRepo as any)
    await useCase.execute('org-1', { stage: 'draft', agent_id: 'agent-1' })
    expect(mockRepo.findByOrg).toHaveBeenCalledWith('org-1', { stage: 'draft', agent_id: 'agent-1' })
  })
})
