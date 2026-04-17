import type { PropertyRepository } from '../../ports/repositories/property-repository'

export class GetPropertyCatalogsUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(): Promise<{
    operation_types: Array<{ id: number; slug: string; label: string }>
    commercial_stages: Array<{ id: number; operation_type_id: number; slug: string; label: string; sort_order: number; is_terminal: boolean; color: string | null }>
    property_statuses: Array<{ id: number; operation_type_id: number; slug: string; label: string; color: string | null }>
  }> {
    return this.propRepo.findCatalogs()
  }
}
