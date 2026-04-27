import type { PropertyVisitFormRepository } from '../../ports/repositories/property-visit-form-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface ArchiveVisitFormInput {
  id: string
  org_id: string
  archived: boolean
}

/**
 * Archiva o desarchiva una ficha de visita. Las archivadas no se incluyen
 * automáticamente en el reporte al propietario, pero quedan recuperables.
 */
export class ArchiveVisitFormUseCase {
  constructor(private readonly repo: PropertyVisitFormRepository) {}

  async execute(input: ArchiveVisitFormInput): Promise<void> {
    const form = await this.repo.findById(input.id, input.org_id)
    if (!form) throw new NotFoundError('PropertyVisitForm', input.id)

    if (input.archived) form.archive()
    else form.unarchive()

    await this.repo.save(form)
  }
}
