import type { Property } from '../../../domain/entities/property'

export interface PropertyFilters {
  status?: string
  agent_id?: string
  neighborhood?: string
  property_type?: string
  /** Slug de etapa — requiere operation_type_id para ser unívoco */
  commercial_stage?: string
  /** Filtro directo por ID de etapa */
  commercial_stage_id?: number
  /** Slug de tipo de operación (legacy) */
  operation_type?: string
  /** Filtro directo por ID de tipo de operación */
  operation_type_id?: number
  /** Filtro directo por ID de estado */
  status_id?: number
  search?: string
}

export interface PropertyRepository {
  findById(id: string, orgId: string): Promise<Property | null>
  findBySlug(slug: string): Promise<Property | null>
  findByOrg(orgId: string, filters?: PropertyFilters): Promise<Property[]>
  save(property: Property): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
