import type { Conversation, ConversationChannel, ConversationStatus } from '../../../domain/entities/conversation'

export interface ConversationFilters {
  status?: ConversationStatus
  channel?: ConversationChannel
  assignee_id?: string
  /** Sin dueño: la cola que hay que repartir. */
  unassigned?: boolean
  limit?: number
}

export interface ConversationRepository {
  findById(id: string, orgId: string): Promise<Conversation | null>
  /** Por el chat del proveedor: es como se reconoce una conversación ya abierta. */
  findByExternalId(orgId: string, channel: ConversationChannel, externalId: string): Promise<Conversation | null>
  findByOrg(orgId: string, filters?: ConversationFilters): Promise<Conversation[]>
  /** Las charlas de una persona: es como se sigue al lead cuando se delega. */
  findByContact(contactId: string, orgId: string): Promise<Conversation[]>
  save(conversation: Conversation): Promise<void>
}
