import type { PrefactibilidadRepository } from '../../ports/repositories/prefactibilidad-repository'
import type { Prefactibilidad } from '../../../domain/entities/prefactibilidad'

export class GetPrefactibilidadDetailUseCase {
  constructor(private readonly repo: PrefactibilidadRepository) {}

  async execute(id: string, orgId: string): Promise<Prefactibilidad | null> {
    return this.repo.findById(id, orgId)
  }
}
