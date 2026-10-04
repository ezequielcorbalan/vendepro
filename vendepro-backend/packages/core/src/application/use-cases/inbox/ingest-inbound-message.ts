import type { ConversationRepository } from '../../ports/repositories/conversation-repository'
import type { MessageRepository } from '../../ports/repositories/message-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Conversation } from '../../../domain/entities/conversation'
import type { ConversationChannel } from '../../../domain/entities/conversation'
import { Message } from '../../../domain/entities/message'
import type { MessageAttachment } from '../../../domain/entities/message'
import { Contact } from '../../../domain/entities/contact'
import { normalizePhone } from '../../../shared/phone'

export interface IngestInboundMessageInput {
  orgId: string
  channel: ConversationChannel
  /** Chat del proveedor: jid de WhatsApp, PSID de Messenger. */
  externalChatId: string
  /** Id del mensaje en el proveedor. Sin esto no hay idempotencia. */
  externalMessageId: string | null
  /** Teléfono del remitente en cualquier formato (WhatsApp manda sólo dígitos). */
  fromPhone: string | null
  /** Nombre que expone el perfil del remitente, si viene. */
  fromName: string | null
  content: string | null
  attachments?: MessageAttachment[]
  /** Momento del mensaje según el proveedor; si no viene, ahora. */
  sentAt?: string
}

export interface IngestInboundMessageResult {
  conversationId: string
  messageId: string
  /** Ya estaba guardado: el proveedor reenvió el webhook. No se avisa de nuevo. */
  duplicate: boolean
  /** La conversación se abrió con este mensaje. */
  conversationCreated: boolean
  contactId: string | null
}

/**
 * Guarda un mensaje entrante y deja la conversación lista para que alguien la
 * atienda.
 *
 * Es el único punto por el que entra todo lo que llega de un canal, así que
 * carga con tres responsabilidades que no se pueden separar sin duplicar
 * trabajo: reconocer la conversación, atarla a un contacto del CRM y mover la
 * ventana de 24h.
 *
 * **Idempotente**: el proveedor reenvía el mismo webhook cuando no recibe un
 * 200 a tiempo, y sin esto el agente vería el mensaje dos veces y el bot
 * respondería dos veces. Se dedupe por el id del mensaje en el proveedor.
 *
 * No notifica a nadie ni dispara el webhook hacia n8n: eso lo hace el worker
 * después de que esto devuelve, para que un fallo del aviso no pierda el
 * mensaje.
 */
export class IngestInboundMessageUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly contacts: ContactRepository,
    private readonly users: UserRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: IngestInboundMessageInput): Promise<IngestInboundMessageResult> {
    const sentAt = input.sentAt ?? new Date().toISOString()

    // 1. ¿Ya lo guardamos? El webhook se reenvía.
    if (input.externalMessageId) {
      const yaEsta = await this.messages.findByExternalId(input.orgId, input.externalMessageId)
      if (yaEsta) {
        return {
          conversationId: yaEsta.conversation_id,
          messageId: yaEsta.id,
          duplicate: true,
          conversationCreated: false,
          contactId: null,
        }
      }
    }

    // 2. La conversación: la de siempre, o una nueva.
    let conversation = await this.conversations.findByExternalId(input.orgId, input.channel, input.externalChatId)
    const conversationCreated = !conversation
    if (!conversation) {
      conversation = Conversation.create({
        id: this.ids.generate(),
        org_id: input.orgId,
        channel: input.channel,
        contact_id: null,
        lead_id: null,
        external_id: input.externalChatId,
        assignee_id: null,
        last_activity_at: sentAt,
        window_expires_at: null,
      })
    }

    // 3. Atarla a un contacto del CRM. Si ya tiene, no se toca: alguien pudo
    //    haberla vinculado a mano al contacto correcto.
    let contactId = conversation.contact_id
    if (!contactId) {
      contactId = await this.resolveContact(input)
      if (contactId) conversation.linkContact(contactId)
    }

    conversation.registerInbound(sentAt)
    await this.conversations.save(conversation)

    const message = Message.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      conversation_id: conversation.id,
      direction: 'in',
      sender_type: 'contact',
      sender_id: null,
      content: input.content ?? null,
      attachments: input.attachments ?? [],
      external_id: input.externalMessageId,
      created_at: sentAt,
    })
    await this.messages.save(message)

    return {
      conversationId: conversation.id,
      messageId: message.id,
      duplicate: false,
      conversationCreated,
      contactId,
    }
  }

  /**
   * Busca el contacto por teléfono y, si no está, lo crea.
   *
   * Se crea en vez de dejarlo suelto porque todo lo demás del CRM cuelga del
   * contacto: sin él la conversación no se puede atar a un lead ni aparecer en
   * la ficha de nadie. Queda con `source: 'whatsapp'` para distinguir los que
   * nacieron de un mensaje de los que cargó un agente.
   *
   * El dueño es el primer admin de la org, igual que los leads que entran por
   * la web: lo que llega es de la inmobiliaria hasta que alguien lo delega. Si
   * la org no tiene admin, no se crea el contacto — la conversación queda sin
   * atar y se puede vincular a mano, que es mejor que inventar un dueño.
   */
  private async resolveContact(input: IngestInboundMessageInput): Promise<string | null> {
    const phone = normalizePhone(input.fromPhone)
    if (!phone) return null

    const existente = await this.contacts.findByEmailOrPhone(input.orgId, null, phone).catch(() => null)
    if (existente) return existente.id

    const admin = await this.users.findFirstAdminByOrg(input.orgId).catch(() => null)
    if (!admin) return null

    const contact = Contact.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      full_name: input.fromName?.trim() || phone,
      phone,
      email: null,
      contact_type: 'comprador',
      neighborhood: null,
      notes: null,
      source: 'whatsapp',
      agent_id: admin.id,
    })
    await this.contacts.save(contact)
    return contact.id
  }
}
