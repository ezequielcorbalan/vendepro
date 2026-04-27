import type { PropertyVisitFormRepository } from '../../ports/repositories/property-visit-form-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface DeleteVisitFormInput {
  id: string
  org_id: string
}

/**
 * Soft-delete de una ficha de visita. Queda fuera del listado y del reporte
 * al propietario; sólo se ve a nivel admin si se necesita auditar.
 */
export class DeleteVisitFormUseCase {
  constructor(private readonly repo: PropertyVisitFormRepository) {}

  async execute(input: DeleteVisitFormInput): Promise<void> {
    const form = await this.repo.findById(input.id, input.org_id)
    if (!form) throw new NotFoundError('PropertyVisitForm', input.id)

    form.softDelete()
    await this.repo.save(form)
  }
}
