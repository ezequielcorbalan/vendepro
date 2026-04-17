import type { PropertyRepository, PropertyPhoto } from '../../ports/repositories/property-repository'
import type { Property } from '../../../domain/entities/property'

export interface PropertyDetailResult {
  property: Property
  photos: PropertyPhoto[]
}

export class GetPropertyDetailUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(id: string, orgId: string): Promise<PropertyDetailResult | null> {
    const property = await this.propRepo.findById(id, orgId)
    if (!property) return null
    const photos = await this.propRepo.findPhotos(id, orgId)
    return { property, photos }
  }
}
