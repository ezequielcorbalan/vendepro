import type { Tag } from '../../../domain/entities/tag'

export interface TagRepository {
  findByOrg(orgId: string): Promise<Tag[]>
  findByLead(leadId: string, orgId: string): Promise<Tag[]>
  /** Tags de los leads de cada contacto, indexados por contact_id */
  findByContactIds(contactIds: string[], orgId: string): Promise<Record<string, Array<{ id: string; name: string; color: string | null }>>>
  findByName(orgId: string, name: string): Promise<Tag | null>
  save(tag: Tag): Promise<void>
  addToLead(leadId: string, tagId: string, orgId: string): Promise<void>
  removeFromLead(leadId: string, tagId: string, orgId: string): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
