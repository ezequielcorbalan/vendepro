import type { Prefactibilidad } from '../../../domain/entities/prefactibilidad'

export interface PrefactibilidadRepository {
  findById(id: string, orgId: string): Promise<Prefactibilidad | null>
  findByOrg(orgId: string): Promise<Prefactibilidad[]>
  findPublicBySlug(slug: string): Promise<Prefactibilidad | null>
  save(prefact: Prefactibilidad): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
