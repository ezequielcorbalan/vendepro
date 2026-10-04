import { ValidationError } from '../errors/validation-error'

export const CONVERSATION_CHANNELS = ['whatsapp', 'instagram', 'facebook'] as const
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number]

/** Misma semántica que Chatwoot: el bot de n8n ya habla este idioma. */
export const CONVERSATION_STATUSES = ['open', 'pending', 'resolved'] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

/** La etiqueta con la que n8n deja de responder una conversación. */
export const LABEL_BOT_PAUSADO = 'bot_pausado'

/** Ventana de WhatsApp: 24h desde el último mensaje del cliente. */
export const WINDOW_HOURS = 24

export interface ConversationProps {
  id: string
  org_id: string
  channel: ConversationChannel
  contact_id: string | null
  lead_id: string | null
  external_id: string
  status: ConversationStatus
  assignee_id: string | null
  labels: string[]
  last_activity_at: string | null
  window_expires_at: string | null
  created_at: string
  updated_at: string
  // Computed (JOIN)
  contact_name?: string | null
  assignee_name?: string | null
  last_message?: string | null
  unread?: number
}

export class Conversation {
  private constructor(private props: ConversationProps) {}

  static create(
    props: Omit<ConversationProps, 'status' | 'labels' | 'created_at' | 'updated_at'> &
      { status?: ConversationStatus; labels?: string[]; created_at?: string; updated_at?: string },
  ): Conversation {
    if (!props.external_id?.trim()) {
      throw new ValidationError('external_id es requerido (el chat del proveedor)')
    }
    if (!CONVERSATION_CHANNELS.includes(props.channel)) {
      throw new ValidationError(`Canal inválido: "${props.channel}"`)
    }
    const status = props.status ?? 'open'
    if (!CONVERSATION_STATUSES.includes(status)) {
      throw new ValidationError(`Estado inválido: "${status}"`)
    }
    const now = new Date().toISOString()
    return new Conversation({
      ...props,
      status,
      labels: props.labels ?? [],
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get channel() { return this.props.channel }
  get contact_id() { return this.props.contact_id }
  get lead_id() { return this.props.lead_id }
  get external_id() { return this.props.external_id }
  get status() { return this.props.status }
  get assignee_id() { return this.props.assignee_id }
  get labels() { return [...this.props.labels] }
  get last_activity_at() { return this.props.last_activity_at }
  get window_expires_at() { return this.props.window_expires_at }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  /** ¿El bot tiene que quedarse callado en esta conversación? */
  get botPausado(): boolean {
    return this.props.labels.includes(LABEL_BOT_PAUSADO)
  }

  /**
   * ¿Se puede escribir libremente, o sólo plantillas aprobadas?
   *
   * Con la API oficial esto lo impone Meta. Con un proveedor no oficial no lo
   * impone nadie, pero la cuenta igual se calcula: la UI muestra el aviso
   * desde el principio y migrar a Cloud API no cambia el comportamiento.
   */
  isWindowOpen(now: Date = new Date()): boolean {
    if (!this.props.window_expires_at) return false
    return new Date(this.props.window_expires_at).getTime() > now.getTime()
  }

  /** Mensaje entrante: reabre la ventana de 24h y despierta la conversación. */
  registerInbound(at: string): void {
    this.props.last_activity_at = at
    this.props.window_expires_at = new Date(new Date(at).getTime() + WINDOW_HOURS * 3600_000).toISOString()
    // Una conversación resuelta que recibe un mensaje vuelve a estar abierta:
    // el cliente escribió de nuevo y alguien tiene que mirarla.
    if (this.props.status === 'resolved') this.props.status = 'open'
    this.touch()
  }

  /** Mensaje saliente: mueve la actividad, pero NO extiende la ventana. */
  registerOutbound(at: string): void {
    this.props.last_activity_at = at
    this.touch()
  }

  assignTo(agentId: string | null): void {
    this.props.assignee_id = agentId
    this.touch()
  }

  setStatus(status: ConversationStatus): void {
    if (!CONVERSATION_STATUSES.includes(status)) {
      throw new ValidationError(`Estado inválido: "${status}"`)
    }
    this.props.status = status
    this.touch()
  }

  setLabels(labels: string[]): void {
    // Sin repetidos ni vacíos: las etiquetas las escribe el bot y la UI, y
    // duplicados harían que "pausar bot" dependa de cuántas veces se aplicó.
    this.props.labels = Array.from(new Set(labels.map(l => l.trim()).filter(Boolean)))
    this.touch()
  }

  linkContact(contactId: string, leadId?: string | null): void {
    this.props.contact_id = contactId
    if (leadId !== undefined) this.props.lead_id = leadId
    this.touch()
  }

  private touch(): void {
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): ConversationProps {
    return { ...this.props, labels: [...this.props.labels] }
  }
}
