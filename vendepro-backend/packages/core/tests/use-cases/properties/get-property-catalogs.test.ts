import { describe, it, expect, vi } from 'vitest'
import { GetPropertyCatalogsUseCase } from '../../../src/application/use-cases/properties/get-property-catalogs'

const mockCatalogs = {
  operation_types: [{ id: 1, slug: 'venta', label: 'Venta' }],
  commercial_stages: [{ id: 1, operation_type_id: 1, slug: 'captacion', label: 'Captación', sort_order: 1, is_terminal: false, color: null }],
  property_statuses: [{ id: 1, operation_type_id: 1, slug: 'active', label: 'Activa', color: null }],
}

const mockRepo = {
  findCatalogs: vi.fn().mockResolvedValue(mockCatalogs),
  findById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
  findPhotos: vi.fn(), findPhotoById: vi.fn(), addPhoto: vi.fn(), deletePhoto: vi.fn(), reorderPhotos: vi.fn(),
  update: vi.fn(), updateStage: vi.fn(), markExternalReport: vi.fn(), clearExternalReport: vi.fn(),
  searchByAddress: vi.fn(), findByPublicSlug: vi.fn(),
}

describe('GetPropertyCatalogsUseCase', () => {
  it('returns catalogs from repo', async () => {
    const useCase = new GetPropertyCatalogsUseCase(mockRepo as any)
    const result = await useCase.execute()
    expect(result.operation_types).toHaveLength(1)
    expect(result.commercial_stages).toHaveLength(1)
    expect(result.property_statuses).toHaveLength(1)
    expect(mockRepo.findCatalogs).toHaveBeenCalled()
  })

  it('delegates to findCatalogs without args', async () => {
    const useCase = new GetPropertyCatalogsUseCase(mockRepo as any)
    await useCase.execute()
    expect(mockRepo.findCatalogs).toHaveBeenCalledTimes(2)
  })
})
