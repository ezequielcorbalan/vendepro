import type { ConversationRepository } from '../../ports/repositories/conversation-repository'
import type { MessageRepository } from '../../ports/repositories/message-repository'
import type { MessagingGateway } from '../../ports/services/messaging-gateway'
import type { IdGenerator } from '../../ports/id-generator'
import { Message } from '../../../domain/entities/message'
import type { MessageSenderType } from '../../../domain/entities/message'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface SendMessageUseCaseInput {
  conversationId: string
  orgId: string
  text: string
  /** 'agent' desde la UI, 'bot' desde n8n. */
  senderType: MessageSenderType
  /** users(id) cuando lo escribe un agente. */
  senderId?: string | null
}

export interface SendMessageUseCaseResult {
  messageId: string
  conversationId: string
  externalId: string | null
}

/**
 * Manda un mensaje por el canal de la conversación y lo deja registrado.
 *
 * El orden importa: primero sale, después se guarda. Si se guardara antes y
 * el proveedor fallara, el agente vería en pantalla un mensaje que el cliente
 * nunca recibió — que es la peor forma de fallar en una herramienta de
 * atención. Al revés, lo peor que pasa es que el mensaje salga y no quede
 * registrado, y de eso se entera el agente cuando no lo ve en el hilo.
 *
 * No aplica la etiqueta `bot_pausado` por su cuenta: el bot vive en n8n y ya
 * tiene esa lógica. Lo que hace el worker es avisarle del mensaje saliente
 * (`message_created` con `message_type: 1`) y n8n decide.
 */
export class SendMessageUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly gateway: MessagingGateway,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SendMessageUseCaseInput): Promise<SendMessageUseCaseResult> {
    const texto = (input.text ?? '').trim()
    if (!texto) throw new ValidationError('El mensaje está vacío')

    const conversation = await this.conversations.findById(input.conversationId, input.orgId)
    if (!conversation) throw new NotFoundError('Conversación', input.conversationId)

    // Fuera de la ventana de 24h, WhatsApp sólo acepta plantillas aprobadas.
    // Con un proveedor que no la impone esto no aplica y se manda igual; con
    // la Cloud API, mandar texto libre acá sería un mensaje perdido del lado
    // de Meta, sin aviso para el agente.
    if (this.gateway.enforcesWindow && conversation.channel === 'whatsapp' && !conversation.isWindowOpen()) {
      throw new ValidationError(
        'Pasaron más de 24 horas desde el último mensaje del cliente: sólo se puede responder con una plantilla aprobada',
      )
    }

    const enviado = await this.gateway.sendText({
      channel: conversation.channel,
      chatId: conversation.external_id,
      text: texto,
    })

    const now = new Date().toISOString()
    const message = Message.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      conversation_id: conversation.id,
      direction: 'out',
      sender_type: input.senderType,
      sender_id: input.senderId ?? null,
      content: texto,
      external_id: enviado.externalId,
      created_at: now,
    })
    await this.messages.save(message)

    // Mueve la actividad pero NO extiende la ventana: la reabre el cliente
    // cuando contesta, no nosotros escribiéndole.
    conversation.registerOutbound(now)
    await this.conversations.save(conversation)

    return { messageId: message.id, conversationId: conversation.id, externalId: enviado.externalId }
  }
}
