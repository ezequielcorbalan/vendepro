import type { PrefactibilidadRepository } from '../../ports/repositories/prefactibilidad-repository'
import type { Prefactibilidad } from '../../../domain/entities/prefactibilidad'

export class GetPrefactibilidadesUseCase {
  constructor(private readonly repo: PrefactibilidadRepository) {}

  async execute(orgId: string): Promise<Prefactibilidad[]> {
    return this.repo.findByOrg(orgId)
  }
}
