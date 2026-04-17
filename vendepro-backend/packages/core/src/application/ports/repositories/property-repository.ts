import type { Property, PropertyProps } from '../../../domain/entities/property'

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

export interface PropertyPhoto {
  id: string
  property_id: string
  org_id: string
  url: string
  r2_key: string
  sort_order: number
  created_at: string
}

export interface OperationType {
  id: number
  slug: string
  label: string
}

export interface CommercialStage {
  id: number
  operation_type_id: number
  slug: string
  label: string
  sort_order: number
  is_terminal: boolean
  color: string | null
}

/**
 * Catálogo de estados de propiedad (tabla property_statuses).
 * Nombrado como "PropertyStatusCatalog" para evitar colisión con PropertyStatus
 * (tipo union ya exportado desde domain/rules). El consumidor usa este tipo en findCatalogs().
 */
export interface PropertyStatusCatalog {
  id: number
  operation_type_id: number
  slug: string
  label: string
  color: string | null
}

export interface PropertyRepository {
  findById(id: string, orgId: string): Promise<Property | null>
  findBySlug(slug: string): Promise<Property | null>
  findByOrg(orgId: string, filters?: PropertyFilters): Promise<Property[]>
  save(property: Property): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  findPhotos(propertyId: string, orgId: string): Promise<PropertyPhoto[]>
  addPhoto(photo: PropertyPhoto): Promise<void>
  deletePhoto(photoId: string, orgId: string): Promise<void>
  reorderPhotos(propertyId: string, orgId: string, order: Array<{ id: string; sort_order: number }>): Promise<void>
  update(id: string, orgId: string, patch: Partial<PropertyProps>): Promise<void>
  updateStage(id: string, orgId: string, stageSlug: string): Promise<void>
  findCatalogs(): Promise<{
    operation_types: OperationType[]
    commercial_stages: CommercialStage[]
    property_statuses: PropertyStatusCatalog[]
  }>
  markExternalReport(id: string, orgId: string): Promise<void>
  clearExternalReport(id: string, orgId: string): Promise<void>
  searchByAddress(orgId: string, query: string, limit: number): Promise<Array<{ id: string; address: string }>>
  findByPublicSlug(slug: string): Promise<Property | null>
}
