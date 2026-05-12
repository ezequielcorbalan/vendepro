export type BotStep = 'welcome' | 'zone' | 'budget' | 'done'
export type BotStatus = 'active' | 'completed' | 'expired'

export interface BotConversation {
  id: string
  org_id: string
  lead_id: string | null
  phone: string
  current_step: BotStep
  answers: Record<string, string>
  status: BotStatus
  created_at: string
  updated_at: string
}

export interface BotConversationRepository {
  findActiveByPhone(phone: string, orgId: string): Promise<BotConversation | null>
  findByLeadId(leadId: string, orgId: string): Promise<BotConversation | null>
  findActiveByOrg(orgId: string, limit?: number): Promise<BotConversation[]>
  save(conversation: BotConversation): Promise<void>
}
