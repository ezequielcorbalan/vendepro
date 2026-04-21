import type { FichaRepository } from '../../ports/repositories/ficha-repository'
import type { FichaTasacion } from '../../../domain/entities/ficha-tasacion'

export class GetFichaUseCase {
  constructor(private readonly repo: FichaRepository) {}

  async execute(id: string, orgId: string): Promise<FichaTasacion | null> {
    return this.repo.findById(id, orgId)
  }
}
