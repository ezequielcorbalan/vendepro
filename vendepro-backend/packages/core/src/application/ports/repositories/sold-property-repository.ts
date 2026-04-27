import type { SoldProperty } from '../../../domain/entities/sold-property'

export interface SoldPropertyFilters {
  /** 'mine' = agent_id == currentUserId; 'team' = otro agent del org; 'external' = sin agent */
  origin?: 'mine' | 'team' | 'external' | 'all'
  currentUserId?: string | null
  property_type?: string | null
  neighborhood?: string | null
  min_covered_area?: number | null
  max_covered_area?: number | null
  closed_after?: string | null   // ISO date
  closed_before?: string | null
  search?: string | null         // matches address_approx / neighborhood / notes
  limit?: number
  offset?: number
}

export interface SoldPropertyRepository {
  findByOrg(orgId: string, filters?: SoldPropertyFilters): Promise<SoldProperty[]>
  findById(id: string, orgId: string): Promise<SoldProperty | null>
  save(prop: SoldProperty): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
