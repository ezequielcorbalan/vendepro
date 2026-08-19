import type { FichaLinkRepository, FichaLinkFilters } from '../../ports/repositories/ficha-link-repository'
import type { FichaLink } from '../../../domain/entities/ficha-link'
import { NotFoundError } from '../../../domain/errors/not-found'

export class ListFichaLinksUseCase {
  constructor(private readonly repo: FichaLinkRepository) {}

  async execute(orgId: string, filters?: FichaLinkFilters): Promise<FichaLink[]> {
    return this.repo.findByOrg(orgId, filters)
  }
}

export interface ArchiveFichaLinkInput {
  id: string
  org_id: string
  archived: boolean
}

/**
 * Archivar corta el link sin borrar lo que ya entró por él: las fichas y leads
 * generados siguen apuntando al registro.
 */
export class ArchiveFichaLinkUseCase {
  constructor(private readonly repo: FichaLinkRepository) {}

  async execute(input: ArchiveFichaLinkInput): Promise<void> {
    const link = await this.repo.findById(input.id, input.org_id)
    if (!link) throw new NotFoundError('FichaLink', input.id)
    await this.repo.setArchived(input.id, input.org_id, input.archived)
  }
}

export class DeleteFichaLinkUseCase {
  constructor(private readonly repo: FichaLinkRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    const link = await this.repo.findById(id, orgId)
    if (!link) throw new NotFoundError('FichaLink', id)
    await this.repo.delete(id, orgId)
  }
}
