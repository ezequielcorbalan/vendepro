import { describe, it, expect, vi } from 'vitest'
import { GetPropertyDetailUseCase } from '../../../src/application/use-cases/properties/get-property-detail'

const mockProperty = { id: 'prop-1', org_id: 'org-1', toObject: () => ({ id: 'prop-1' }) }
const mockPhotos = [{ id: 'photo-1', url: 'https://r2/photo1.jpg', sort_order: 0 }]

const mockRepo = {
  findById: vi.fn().mockResolvedValue(mockProperty),
  findPhotos: vi.fn().mockResolvedValue(mockPhotos),
  findPhotoById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
  addPhoto: vi.fn(), deletePhoto: vi.fn(), reorderPhotos: vi.fn(), update: vi.fn(), updateStage: vi.fn(),
  findCatalogs: vi.fn(), markExternalReport: vi.fn(), clearExternalReport: vi.fn(),
  searchByAddress: vi.fn(), findByPublicSlug: vi.fn(),
}

describe('GetPropertyDetailUseCase', () => {
  it('returns property and photos when found', async () => {
    const useCase = new GetPropertyDetailUseCase(mockRepo as any)
    const result = await useCase.execute('prop-1', 'org-1')
    expect(result).not.toBeNull()
    expect(result!.property).toBe(mockProperty)
    expect(result!.photos).toBe(mockPhotos)
  })

  it('returns null when property not found', async () => {
    const noRepo = { ...mockRepo, findById: vi.fn().mockResolvedValue(null) }
    const useCase = new GetPropertyDetailUseCase(noRepo as any)
    const result = await useCase.execute('unknown', 'org-1')
    expect(result).toBeNull()
  })

  it('calls findPhotos with correct propertyId and orgId', async () => {
    const useCase = new GetPropertyDetailUseCase(mockRepo as any)
    await useCase.execute('prop-1', 'org-1')
    expect(mockRepo.findPhotos).toHaveBeenCalledWith('prop-1', 'org-1')
  })
})
