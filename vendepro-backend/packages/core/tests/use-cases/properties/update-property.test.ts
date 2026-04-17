import { describe, it, expect, vi } from 'vitest'
import { UpdatePropertyUseCase } from '../../../src/application/use-cases/properties/update-property'

const mockProperty = { id: 'prop-1', org_id: 'org-1' }

const mockRepo = {
  findById: vi.fn().mockResolvedValue(mockProperty),
  update: vi.fn().mockResolvedValue(undefined),
  findPhotoById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
  findPhotos: vi.fn(), addPhoto: vi.fn(), deletePhoto: vi.fn(), reorderPhotos: vi.fn(), updateStage: vi.fn(),
  findCatalogs: vi.fn(), markExternalReport: vi.fn(), clearExternalReport: vi.fn(),
  searchByAddress: vi.fn(), findByPublicSlug: vi.fn(),
}

describe('UpdatePropertyUseCase', () => {
  it('updates property when found', async () => {
    const useCase = new UpdatePropertyUseCase(mockRepo as any)
    await useCase.execute('prop-1', 'org-1', { address: 'New Street 123' })
    expect(mockRepo.update).toHaveBeenCalledWith('prop-1', 'org-1', { address: 'New Street 123' })
  })

  it('throws 404 error when property not found', async () => {
    const noRepo = { ...mockRepo, findById: vi.fn().mockResolvedValue(null) }
    const useCase = new UpdatePropertyUseCase(noRepo as any)
    await expect(useCase.execute('unknown', 'org-1', {})).rejects.toMatchObject({ statusCode: 404 })
  })
})
