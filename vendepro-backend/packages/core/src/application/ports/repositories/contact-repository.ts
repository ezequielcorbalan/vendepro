import type { Contact } from '../../../domain/entities/contact'

export interface ContactFilters {
  search?: string
  agent_id?: string
  /**
   * Lo que puede ver un agente: los contactos a su nombre y los de sus leads.
   * Por separado de `agent_id` porque el contacto de un lead delegado suele
   * seguir a nombre de quien lo cargó (o del admin, si entró por WhatsApp).
   */
  visible_to?: string
  /** Filtra contactos cuyos leads tengan este tag */
  tag_id?: string
}

export interface ContactRepository {
  findById(id: string, orgId: string): Promise<Contact | null>
  /** Misma regla que `visible_to`, para un contacto puntual. */
  isVisibleTo(id: string, orgId: string, userId: string): Promise<boolean>
  findByOrg(orgId: string, filters?: ContactFilters): Promise<Contact[]>
  findByEmailOrPhone(orgId: string, email: string | null, phone: string | null): Promise<Contact | null>
  /** Por IGSID/PSID: en Instagram no hay teléfono con qué cruzar. */
  findByMetaUserId(orgId: string, metaUserId: string): Promise<Contact | null>
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
