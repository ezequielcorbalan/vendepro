import type { ConversationRepository } from '../../ports/repositories/conversation-repository'
import type { MessageRepository } from '../../ports/repositories/message-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { Conversation } from '../../../domain/entities/conversation'
import type { Message } from '../../../domain/entities/message'
import type { ConversationStatus } from '../../../domain/entities/conversation'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'

/**
 * Las operaciones que el bot de n8n y la UI hacen sobre una conversación:
 * leerla, asignarla, etiquetarla y abrirla o cerrarla.
 *
 * Van juntas en un archivo porque son cuatro verbos sobre la misma entidad,
 * cada uno de tres líneas; separarlas en cuatro archivos sería más ceremonia
 * que código. El envío de mensajes sí vive aparte: tiene un proveedor externo
 * de por medio y reglas propias.
 */

export class GetConversationThreadUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
  ) {}

  /** La conversación sola: el bot la consulta para saber si está pausado. */
  async getConversation(id: string, orgId: string): Promise<Conversation> {
    const conversation = await this.conversations.findById(id, orgId)
    if (!conversation) throw new NotFoundError('Conversación', id)
    return conversation
  }

  /** El historial, que el bot usa como contexto. */
  async getMessages(id: string, orgId: string, limit?: number): Promise<Message[]> {
    await this.getConversation(id, orgId)
    return this.messages.findByConversation(id, orgId, limit)
  }
}

export class AssignConversationUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly users: UserRepository,
  ) {}

  /** `assigneeId` null la devuelve a la cola sin dueño. */
  async execute(id: string, orgId: string, assigneeId: string | null): Promise<Conversation> {
    const conversation = await this.conversations.findById(id, orgId)
    if (!conversation) throw new NotFoundError('Conversación', id)

    if (assigneeId) {
      const agente = await this.users.findById(assigneeId, orgId)
      if (!agente) throw new NotFoundError('Agente', assigneeId)
      if (!agente.active) throw new ValidationError('Ese agente está dado de baja')
    }

    conversation.assignTo(assigneeId)
    await this.conversations.save(conversation)
    return conversation
  }
}

export class SetConversationLabelsUseCase {
  constructor(private readonly conversations: ConversationRepository) {}

  /**
   * Reemplaza las etiquetas. Es un reemplazo y no un agregado porque así lo
   * espera el bot, que manda la lista completa cada vez (`bot_pausado` se
   * saca mandando la lista sin esa etiqueta).
   */
  async execute(id: string, orgId: string, labels: string[]): Promise<Conversation> {
    const conversation = await this.conversations.findById(id, orgId)
    if (!conversation) throw new NotFoundError('Conversación', id)

    conversation.setLabels(Array.isArray(labels) ? labels : [])
    await this.conversations.save(conversation)
    return conversation
  }
}

export class ToggleConversationStatusUseCase {
  constructor(private readonly conversations: ConversationRepository) {}

  /**
   * Sin `status` alterna abierta ↔ resuelta, que es lo que hace el botón de
   * la UI y lo que el bot llama al cerrar. Con `status` lo fija (incluido
   * `pending`, que no entra en la alternancia).
   */
  async execute(id: string, orgId: string, status?: ConversationStatus): Promise<Conversation> {
    const conversation = await this.conversations.findById(id, orgId)
    if (!conversation) throw new NotFoundError('Conversación', id)

    conversation.setStatus(status ?? (conversation.status === 'resolved' ? 'open' : 'resolved'))
    await this.conversations.save(conversation)
    return conversation
  }
}
