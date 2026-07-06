import type { Contact } from '../../../domain/entities/contact'

export interface ContactFilters {
  search?: string
  agent_id?: string
  /** Filtra contactos cuyos leads tengan este tag */
  tag_id?: string
}

export interface ContactRepository {
  findById(id: string, orgId: string): Promise<Contact | null>
  findByOrg(orgId: string, filters?: ContactFilters): Promise<Contact[]>
  findByEmailOrPhone(orgId: string, email: string | null, phone: string | null): Promise<Contact | null>
  /** Dirección de la propiedad del lead más reciente de cada contacto, indexada por contact_id */
  findLeadPropertyByContactIds(contactIds: string[], orgId: string): Promise<Record<string, string>>
  save(contact: Contact): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  searchByName(orgId: string, query: string, limit: number): Promise<Array<{ id: string; full_name: string }>>
  findWithLeadsAndProperties(id: string, orgId: string): Promise<{
    contact: Contact
    agent_name: string | null
    leads: Array<{ id: string; full_name: string; stage: string }>
    properties: Array<{ id: string; address: string; status: string }>
  } | null>
}
