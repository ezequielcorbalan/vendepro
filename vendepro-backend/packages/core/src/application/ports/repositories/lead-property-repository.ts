import type { LeadProperty } from '../../../domain/entities/lead-property'

/** Fila para la vista "Interesados" de una propiedad: relación + datos del lead. */
export interface InterestedLeadRow {
  id: string
  lead_id: string
  property_id: string
  status: string
  notes: string | null
  feedback: string | null
  created_at: string
  updated_at: string
  lead_full_name: string
  lead_stage: string
  lead_pipeline: string
  lead_phone: string | null
  lead_assigned_to: string | null
  lead_assigned_name: string | null
}

/** Fila para la sección "Propiedades de interés" de un lead: relación + datos de la propiedad. */
export interface LeadPropertyWithProperty {
  id: string
  lead_id: string
  property_id: string
  status: string
  notes: string | null
  feedback: string | null
  created_at: string
  updated_at: string
  property_address: string
  property_neighborhood: string
  property_cover_photo: string | null
  property_asking_price: number | null
  property_currency: string | null
  property_source: string
}

export interface LeadPropertyRepository {
  findById(id: string, orgId: string): Promise<LeadProperty | null>
  findByLead(leadId: string, orgId: string): Promise<LeadProperty[]>
  findByLeadAndProperty(leadId: string, propertyId: string, orgId: string): Promise<LeadProperty | null>
  /** Relaciones del lead con datos de la propiedad (JOIN properties) para la UI. */
  findByLeadWithProperty(leadId: string, orgId: string): Promise<LeadPropertyWithProperty[]>
  /** Leads interesados en una propiedad (JOIN leads + users) para la pestaña Interesados. */
  findInterestedByProperty(propertyId: string, orgId: string): Promise<InterestedLeadRow[]>
  save(leadProperty: LeadProperty): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
