import { describe, it, expect, vi } from 'vitest'
import { UploadPropertyPhotoUseCase } from '../../../src/application/use-cases/properties/upload-property-photo'

const mockRepo = {
  findPhotos: vi.fn().mockResolvedValue([]),
  addPhoto: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(), findPhotoById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
  deletePhoto: vi.fn(), reorderPhotos: vi.fn(), update: vi.fn(), updateStage: vi.fn(),
  findCatalogs: vi.fn(), markExternalReport: vi.fn(), clearExternalReport: vi.fn(),
  searchByAddress: vi.fn(), findByPublicSlug: vi.fn(),
}

const mockStorage = {
  upload: vi.fn().mockResolvedValue('https://r2.example.com/photo.jpg'),
  delete: vi.fn(),
  getUrl: vi.fn(),
}

const mockIdGen = { generate: vi.fn().mockReturnValue('photo-id-123') }

describe('UploadPropertyPhotoUseCase', () => {
  it('uploads to R2 and saves photo to DB', async () => {
    const useCase = new UploadPropertyPhotoUseCase(mockRepo as any, mockStorage as any, mockIdGen)
    const result = await useCase.execute({
      propertyId: 'prop-1',
      orgId: 'org-1',
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      buffer: new ArrayBuffer(10),
    })
    expect(mockStorage.upload).toHaveBeenCalledWith(
      'cuentas/org-1/propiedades/prop-1/fotos/photo-id-123',
      expect.any(ArrayBuffer),
      'image/jpeg',
    )
    expect(mockRepo.addPhoto).toHaveBeenCalled()
    expect(result.id).toBe('photo-id-123')
    expect(result.url).toBe('https://r2.example.com/photo.jpg')
    expect(result.sort_order).toBe(0)
  })

  it('sets correct sort_order based on existing photo count', async () => {
    const repoWithPhotos = {
      ...mockRepo,
      findPhotos: vi.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]),
    }
    const useCase = new UploadPropertyPhotoUseCase(repoWithPhotos as any, mockStorage as any, mockIdGen)
    const result = await useCase.execute({
      propertyId: 'prop-1', orgId: 'org-1',
      fileName: 'test.jpg', contentType: 'image/jpeg', buffer: new ArrayBuffer(5),
    })
    expect(result.sort_order).toBe(2)
  })
})
