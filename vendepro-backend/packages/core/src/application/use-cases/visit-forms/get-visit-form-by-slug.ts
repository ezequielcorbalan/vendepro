import type {
  PropertyVisitFormRepository,
  PropertyVisitFormWithContext,
} from '../../ports/repositories/property-visit-form-repository'

/**
 * Endpoint público (sin auth): devuelve la ficha + datos mínimos de la
 * propiedad para pre-llenar/contextualizar el formulario que ve el visitante.
 */
export class GetVisitFormBySlugUseCase {
  constructor(private readonly repo: PropertyVisitFormRepository) {}

  async execute(slug: string): Promise<PropertyVisitFormWithContext | null> {
    return this.repo.findBySlugWithContext(slug)
  }
}
