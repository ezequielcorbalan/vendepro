import type { Landing } from '../../../domain/entities/landing'
import type { LandingStatusValue } from '../../../domain/value-objects/landing-status'

export interface LandingFilters {
  status?: LandingStatusValue | LandingStatusValue[]
  agent_id?: string
  kind?: 'lead_capture' | 'property'
}

export interface LandingRepository {
  findById(id: string, orgId: string): Promise<Landing | null>
  findByFullSlug(fullSlug: string): Promise<Landing | null>
  findByOrg(orgId: string, filters?: LandingFilters): Promise<Landing[]>
  /**
   * Lista landings que actúan como plantillas reutilizables (ej: 'tasacion').
   * Si el frontend filtra por `template_type=tasacion`, devuelve solo las
   * landings de la org marcadas con ese template_type.
   */
  findTemplatesByType(orgId: string, templateType: string): Promise<Landing[]>
  save(landing: Landing): Promise<void>
  existsFullSlug(fullSlug: string): Promise<boolean>
}
