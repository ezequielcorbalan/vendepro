import type { Lead } from '../../../domain/entities/lead'

export interface LeadFilters {
  stage?: string
  agent_id?: string
  search?: string
}

export interface LeadRepository {
  findById(id: string, orgId: string): Promise<Lead | null>
  findByOrg(orgId: string, filters?: LeadFilters): Promise<Lead[]>
  save(lead: Lead): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
