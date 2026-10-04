import type { Message } from '../../../domain/entities/message'

export interface MessageRepository {
  findByConversation(conversationId: string, orgId: string, limit?: number): Promise<Message[]>
  /** Idempotencia de la ingesta: el proveedor reenvía el mismo webhook. */
  findByExternalId(orgId: string, externalId: string): Promise<Message | null>
  save(message: Message): Promise<void>
}
