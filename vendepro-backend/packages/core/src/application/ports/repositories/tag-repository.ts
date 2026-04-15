import type { Tag } from '../../../domain/entities/tag'

export interface TagRepository {
  findByOrg(orgId: string): Promise<Tag[]>
  findByLead(leadId: string, orgId: string): Promise<Tag[]>
  save(tag: Tag): Promise<void>
  addToLead(leadId: string, tagId: string, orgId: string): Promise<void>
  removeFromLead(leadId: string, tagId: string, orgId: string): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
