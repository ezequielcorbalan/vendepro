import type { Property } from '../../../domain/entities/property'

export interface PropertyFilters {
  status?: string
  agent_id?: string
  neighborhood?: string
  property_type?: string
}

export interface PropertyRepository {
  findById(id: string, orgId: string): Promise<Property | null>
  findBySlug(slug: string): Promise<Property | null>
  findByOrg(orgId: string, filters?: PropertyFilters): Promise<Property[]>
  save(property: Property): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
