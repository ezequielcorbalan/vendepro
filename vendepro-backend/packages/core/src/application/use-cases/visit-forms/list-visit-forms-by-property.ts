import type { PropertyVisitFormRepository } from '../../ports/repositories/property-visit-form-repository'
import type { PropertyVisitForm } from '../../../domain/entities/property-visit-form'

/**
 * Endpoint autenticado: lista las fichas de visita de una propiedad
 * (tanto las enviadas como las pendientes).
 */
export class ListVisitFormsByPropertyUseCase {
  constructor(private readonly repo: PropertyVisitFormRepository) {}

  async execute(propertyId: string, orgId: string): Promise<PropertyVisitForm[]> {
    return this.repo.listByProperty(propertyId, orgId)
  }
}
