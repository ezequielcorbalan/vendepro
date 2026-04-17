import { describe, it, expect, vi } from 'vitest'
import { AddAppraisalComparableUseCase } from '../../../src/application/use-cases/appraisals/add-appraisal-comparable'
import { RemoveAppraisalComparableUseCase } from '../../../src/application/use-cases/appraisals/remove-appraisal-comparable'

const mockRepo = {
  addComparable: vi.fn().mockResolvedValue(undefined),
  removeComparable: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
  countByOrg: vi.fn(), countByOrgAndStage: vi.fn(), countByAgent: vi.fn(),
  findComparables: vi.fn(), update: vi.fn(), findPublicByIdOrSlugWithOrg: vi.fn(),
}
const mockIdGen = { generate: vi.fn().mockReturnValue('comp-id-1') }

describe('AddAppraisalComparableUseCase', () => {
  it('adds comparable and returns generated id', async () => {
    const useCase = new AddAppraisalComparableUseCase(mockRepo as any, mockIdGen)
    const result = await useCase.execute({
      appraisal_id: 'app-1',
      zonaprop_url: 'https://zonaprop.com.ar/123',
      address: 'Av. Santa Fe 1000',
      price: 150000,
    })
    expect(result.id).toBe('comp-id-1')
    expect(mockRepo.addComparable).toHaveBeenCalledWith(expect.objectContaining({
      id: 'comp-id-1',
      appraisal_id: 'app-1',
      price: 150000,
    }))
  })
})

describe('RemoveAppraisalComparableUseCase', () => {
  it('removes comparable by id', async () => {
    const useCase = new RemoveAppraisalComparableUseCase(mockRepo as any)
    await useCase.execute('comp-id-1')
    expect(mockRepo.removeComparable).toHaveBeenCalledWith('comp-id-1')
  })
})
