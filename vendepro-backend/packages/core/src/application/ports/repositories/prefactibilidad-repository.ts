import type { Prefactibilidad } from '../../../domain/entities/prefactibilidad'

export interface PrefactPublicResult {
  prefact: Prefactibilidad
  org: { name: string; logo_url: string | null; brand_color: string | null }
}

export interface PrefactibilidadRepository {
  findById(id: string, orgId: string): Promise<Prefactibilidad | null>
  findByOrg(orgId: string): Promise<Prefactibilidad[]>
  findPublicBySlug(slug: string): Promise<Prefactibilidad | null>
  findPublicBySlugWithOrg(slug: string): Promise<PrefactPublicResult | null>
  save(prefact: Prefactibilidad): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
