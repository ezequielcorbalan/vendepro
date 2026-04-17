import type { PrefactibilidadRepository } from '../../ports/repositories/prefactibilidad-repository'
import type { Prefactibilidad } from '../../../domain/entities/prefactibilidad'

export interface GetPublicPrefactibilidadResult {
  prefact: Prefactibilidad
  org: { name: string; logo_url: string | null; brand_color: string | null }
}

export class GetPublicPrefactibilidadUseCase {
  constructor(private readonly prefactRepo: PrefactibilidadRepository) {}

  async execute(slug: string): Promise<GetPublicPrefactibilidadResult | null> {
    return this.prefactRepo.findPublicBySlugWithOrg(slug)
  }
}
