import type { FichaLink } from '../../../domain/entities/ficha-link'

export interface FichaLinkFilters {
  agent_id?: string
  lead_id?: string
  mode?: 'single' | 'open'
  include_archived?: boolean
}

export interface FichaLinkRepository {
  findById(id: string, orgId: string): Promise<FichaLink | null>
  /** Resolución pública: sin org_id, el slug es el secreto. */
  findBySlug(slug: string): Promise<FichaLink | null>
  existsBySlug(slug: string): Promise<boolean>
  findByOrg(orgId: string, filters?: FichaLinkFilters): Promise<FichaLink[]>
  /** Link 'open' vigente de un agente; NULL agent_id = el institucional de la org. */
  findOpenLink(orgId: string, agentId: string | null): Promise<FichaLink | null>
  save(link: FichaLink): Promise<void>
  /** Suma un envío y sella last_submitted_at. Cierra los links 'single'. */
  registerSubmission(id: string): Promise<void>
  setArchived(id: string, orgId: string, archived: boolean): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
