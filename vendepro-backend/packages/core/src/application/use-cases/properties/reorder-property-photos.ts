import type { PropertyRepository } from '../../ports/repositories/property-repository'

export class ReorderPropertyPhotosUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(propertyId: string, orgId: string, order: Array<{ id: string; sort_order: number }>): Promise<void> {
    if (!Array.isArray(order) || order.length === 0) return
    await this.propRepo.reorderPhotos(propertyId, orgId, order)
  }
}
