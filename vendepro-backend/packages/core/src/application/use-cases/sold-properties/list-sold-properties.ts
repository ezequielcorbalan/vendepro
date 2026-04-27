import type { SoldPropertyRepository, SoldPropertyFilters } from '../../ports/repositories/sold-property-repository'
import type { SoldProperty } from '../../../domain/entities/sold-property'

export class ListSoldPropertiesUseCase {
  constructor(private readonly repo: SoldPropertyRepository) {}

  async execute(orgId: string, filters: SoldPropertyFilters = {}): Promise<SoldProperty[]> {
    return this.repo.findByOrg(orgId, filters)
  }
}
