import type { FichaTasacion } from '../../../domain/entities/ficha-tasacion'

export interface FichaFilters {
  lead_id?: string
  agent_id?: string
}

export interface FichaRepository {
  findById(id: string, orgId: string): Promise<FichaTasacion | null>
  findByAppraisal(appraisalId: string, orgId: string): Promise<FichaTasacion[]>
  findByLead(leadId: string, orgId: string): Promise<FichaTasacion[]>
  findByOrg(orgId: string, filters?: FichaFilters): Promise<FichaTasacion[]>
  findPublicBySlug(slug: string): Promise<FichaTasacion | null>
  save(ficha: FichaTasacion): Promise<void>
  update(id: string, orgId: string, patch: Record<string, unknown>): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
