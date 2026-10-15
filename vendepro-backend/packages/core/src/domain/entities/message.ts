import { ValidationError } from '../errors/validation-error'

export const MESSAGE_DIRECTIONS = ['in', 'out'] as const
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number]

export const MESSAGE_SENDER_TYPES = ['contact', 'agent', 'bot'] as const
export type MessageSenderType = (typeof MESSAGE_SENDER_TYPES)[number]

export interface MessageAttachment {
  /** 'image' | 'audio' | 'video' | 'document' | 'sticker' … lo que mande el canal. */
  type: string
  url?: string | null
  mime?: string | null
  filename?: string | null
}

export interface MessageProps {
  id: string
  org_id: string
  conversation_id: string
  direction: MessageDirection
  sender_type: MessageSenderType
  /** users(id) cuando lo escribió un agente desde la UI. */
  sender_id: string | null
  content: string | null
  attachments: MessageAttachment[]
  /** Id del mensaje en el proveedor: es la clave de idempotencia de la ingesta. */
  external_id: string | null
  created_at: string
  // Computed (JOIN)
  sender_name?: string | null
}

export class Message {
  private constructor(private props: MessageProps) {}

  static create(
    props: Omit<MessageProps, 'attachments' | 'created_at'> &
      { attachments?: MessageAttachment[]; created_at?: string },
  ): Message {
    if (!MESSAGE_DIRECTIONS.includes(props.direction)) {
      throw new ValidationError(`Dirección inválida: "${props.direction}"`)
    }
    if (!MESSAGE_SENDER_TYPES.includes(props.sender_type)) {
      throw new ValidationError(`Tipo de emisor inválido: "${props.sender_type}"`)
    }
    const attachments = props.attachments ?? []
    // Un mensaje sin texto es válido si trae un audio o una foto — y los
    // audios son buena parte del tráfico real. Vacío del todo, no.
    if (!props.content?.trim() && attachments.length === 0) {
      throw new ValidationError('El mensaje no tiene contenido ni adjuntos')
    }
    return new Message({
      ...props,
      attachments,
      created_at: props.created_at ?? new Date().toISOString(),
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get conversation_id() { return this.props.conversation_id }
  get direction() { return this.props.direction }
  get sender_type() { return this.props.sender_type }
  get sender_id() { return this.props.sender_id }
  get content() { return this.props.content }
  get attachments() { return [...this.props.attachments] }
  get external_id() { return this.props.external_id }
  get created_at() { return this.props.created_at }

  /**
   * El `message_type` de Chatwoot, que es lo que el bot de n8n lee para saber
   * si el mensaje es del cliente o nuestro: 0 = entrante, 1 = saliente.
   */
  get messageType(): 0 | 1 {
    return this.props.direction === 'in' ? 0 : 1
  }

  toObject(): MessageProps {
    return { ...this.props, attachments: [...this.props.attachments] }
  }
}
