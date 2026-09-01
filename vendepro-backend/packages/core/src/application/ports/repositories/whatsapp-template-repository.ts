import type { WhatsAppTemplate } from '../../../domain/entities/whatsapp-template'

export interface WhatsAppTemplateRepository {
  findByOrg(orgId: string, opts?: { onlyActive?: boolean }): Promise<WhatsAppTemplate[]>
  findById(id: string, orgId: string): Promise<WhatsAppTemplate | null>
  save(template: WhatsAppTemplate): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
