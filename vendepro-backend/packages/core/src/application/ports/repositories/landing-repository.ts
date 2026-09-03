import type { Landing, LandingKind } from '../../../domain/entities/landing'
import type { LandingStatusValue } from '../../../domain/value-objects/landing-status'

export interface LandingFilters {
  status?: LandingStatusValue | LandingStatusValue[]
  agent_id?: string
  kind?: LandingKind
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
  /**
   * La landing publicada de un agente para un kind dado. Si hubiera más de una
   * (no debería), devuelve la publicada más recientemente.
   */
  findPublishedByAgentAndKind(orgId: string, agentId: string, kind: LandingKind): Promise<Landing | null>
  save(landing: Landing): Promise<void>
  existsFullSlug(fullSlug: string): Promise<boolean>
}
