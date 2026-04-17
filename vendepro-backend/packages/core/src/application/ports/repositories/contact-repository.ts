import type { Contact } from '../../../domain/entities/contact'

export interface ContactFilters {
  search?: string
  agent_id?: string
}

export interface ContactRepository {
  findById(id: string, orgId: string): Promise<Contact | null>
  findByOrg(orgId: string, filters?: ContactFilters): Promise<Contact[]>
  save(contact: Contact): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  findWithLeadsAndProperties(id: string, orgId: string): Promise<{
    contact: Contact
    leads: Array<{ id: string; full_name: string; stage: string }>
    properties: Array<{ id: string; address: string; status: string }>
  } | null>
}
