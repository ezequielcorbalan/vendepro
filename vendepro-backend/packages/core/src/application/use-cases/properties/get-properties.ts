import type { PropertyRepository, PropertyFilters } from '../../ports/repositories/property-repository'
import type { Property } from '../../../domain/entities/property'

export class GetPropertiesUseCase {
  constructor(private readonly propertyRepo: PropertyRepository) {}

  async execute(orgId: string, filters?: PropertyFilters): Promise<Property[]> {
    return this.propertyRepo.findByOrg(orgId, filters)
  }
}
