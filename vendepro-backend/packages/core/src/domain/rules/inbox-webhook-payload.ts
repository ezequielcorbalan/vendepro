import type { ConversationChannel, ConversationStatus } from '../entities/conversation'
import type { MessageAttachment, MessageDirection, MessageSenderType } from '../entities/message'

/**
 * El payload de `message_created` que consume el bot de n8n.
 *
 * Existe como UNA función porque antes estaba escrito a mano en cada lugar que
 * emitía el evento, y cada copia se desvió a su manera: una mandaba los
 * adjuntos como `type` en vez de `file_type`, otra el teléfono sin `+`, otra el
 * chat de WhatsApp con el `@c.us` pegado, y el envío del bot directamente no
 * avisaba. Ninguno de esos errores tiraba excepción: el bot simplemente dejaba
 * de entender los mensajes, en silencio y en producción.
 *
 * La forma sale del brief del bot (sección 6), que documenta lo que Onetalk
 * (Chatwoot) le manda hoy. **Cambiar un campo acá es cambiar el contrato con
 * n8n**: los campos se agregan, nunca se renombran ni se sacan.
 *
 * Va PLANO, sin un `body` intermedio. El brief lo muestra como
 * `{event, body: {conversation, ...}}`, pero ese `body` es cómo el nodo
 * Webhook de n8n presenta lo que recibe: n8n mete el cuerpo de cualquier
 * request bajo `body`. Chatwoot manda los campos planos, y adentro de n8n se
 * leen como `$json.body.conversation`. Si acá se anidara otro `body`, el bot
 * tendría que leer `$json.body.body.conversation` y se rompería entero.
 */

export interface InboxWebhookInput {
  conversation: {
    id: string
    channel: ConversationChannel
    /** Chat del proveedor: jid de WhatsApp o IGSID/PSID de Meta. */
    externalId: string
    status?: ConversationStatus
    labels?: string[]
  }
  message: {
    id: string
    content: string | null
    attachments?: MessageAttachment[]
    direction: MessageDirection
    senderType: MessageSenderType
    createdAt: string
  }
  /** Nombre de quien escribió: el contacto, el agente o el bot. */
  senderName?: string | null
}

/**
 * Chatwoot tipifica los adjuntos en cuatro valores. El bot decide qué hacer con
 * un audio leyendo `file_type`, así que cualquier otra cosa que mande el
 * proveedor ("document", "ptt", "sticker", "voice") se traduce acá.
 */
function chatwootFileType(tipo: string): 'image' | 'audio' | 'video' | 'file' {
  const t = (tipo || '').toLowerCase()
  if (t === 'image' || t === 'sticker') return 'image'
  if (t === 'audio' || t === 'ptt' || t === 'voice') return 'audio'
  if (t === 'video') return 'video'
  return 'file'
}

/**
 * Teléfono en E.164 (`+549…`), como lo manda Chatwoot.
 *
 * Se arma desde el chat de WhatsApp y no desde el teléfono del contacto en el
 * CRM: el jid ya viene en formato internacional (`5491155551234@c.us`),
 * mientras que el del CRM está guardado en formato nacional (`1155551234`) y
 * reconstruir el `+549` desde ahí obliga a adivinar si es celular.
 */
export function telefonoE164DesdeChat(channel: ConversationChannel, externalId: string): string | null {
  if (channel !== 'whatsapp') return null
  const digitos = externalId.split('@')[0]?.replace(/\D/g, '') ?? ''
  return digitos ? `+${digitos}` : null
}

/** `source_id` sin decoración: dígitos en WhatsApp, el IGSID en Meta. */
function sourceIdDesdeChat(channel: ConversationChannel, externalId: string): string {
  if (channel !== 'whatsapp') return externalId
  return externalId.split('@')[0]?.replace(/\D/g, '') ?? externalId
}

/**
 * Tipo de quien escribió, con los nombres de Chatwoot. Es un campo AGREGADO al
 * brief: sin él, un mensaje saliente de un agente y uno del bot llegan iguales
 * a n8n, y el bot no puede saber si tiene que pausarse.
 */
function senderTipo(senderType: MessageSenderType): 'contact' | 'user' | 'agent_bot' {
  if (senderType === 'agent') return 'user'
  if (senderType === 'bot') return 'agent_bot'
  return 'contact'
}

export function buildMessageCreatedPayload(input: InboxWebhookInput) {
  const { conversation, message } = input
  const entrante = message.direction === 'in'

  return {
    event: 'message_created' as const,
    // ── Lo que documenta el brief, con los nombres exactos ──
    conversation: {
      id: conversation.id,
      channel: conversation.channel,
      // Agregados: con esto el bot puede chequear la pausa sin otra llamada.
      status: conversation.status ?? 'open',
      labels: conversation.labels ?? [],
    },
    sender: {
      // El teléfono es del CLIENTE aunque el mensaje sea saliente: es lo que
      // el bot usa para identificar la conversación.
      phone_number: telefonoE164DesdeChat(conversation.channel, conversation.externalId),
      name: input.senderName ?? null,
      type: senderTipo(message.senderType),
    },
    content: message.content,
    contact_inbox: { source_id: sourceIdDesdeChat(conversation.channel, conversation.externalId) },
    // 0 = entrante del cliente, 1 = saliente. Es lo que lee el bot.
    message_type: entrante ? 0 : 1,
    attachments: (message.attachments ?? []).map(a => ({
      file_type: chatwootFileType(a.type),
      data_url: a.url ?? null,
    })),
    private: false,
    // ── Agregados, para lo que el bot pueda necesitar después ──
    id: message.id,
    created_at: message.createdAt,
  }
}
