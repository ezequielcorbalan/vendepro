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
  searchByName(orgId: string, query: string, limit: number): Promise<Array<{ id: string; full_name: string }>>
  findPendingFollowups(orgId: string, now: string, limit: number): Promise<Array<{ id: string; full_name: string; next_step: string | null; next_step_date: string | null; stage: string }>>
  /** Returns raw rows with assigned_name via JOIN — acceptable for CSV export outside domain types */
  exportAllWithAssignedName(orgId: string): Promise<Array<Record<string, unknown>>>
}
