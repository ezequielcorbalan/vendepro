import { ValidationError } from '../errors/validation-error'

export type MetaEventLogStatus = 'pending' | 'sent' | 'failed'
export type MarketingProvider = 'meta' | 'ga4'

export interface MetaEventLogProps {
  id: string
  org_id: string
  /** Agente dueño de la config que disparó el evento (para ver "mis eventos"). */
  agent_id: string | null
  provider: MarketingProvider
  /** Tipo de entidad CRM que originó el evento: lead/appraisal/reservation/... */
  entity_type: string | null
  entity_id: string | null
  /** Mantiene compat con el hook de advance-lead-stage (lead_id es el más común). */
  lead_id: string | null
  event_id: string
  event_name: string
  status: MetaEventLogStatus
  response_code: number | null
  response_body: string | null
  attempts: number
  last_error: string | null
  sent_at: string | null
  created_at: string
}

export class MetaEventLog {
  private constructor(private props: MetaEventLogProps) {}

  static create(
    input: Omit<MetaEventLogProps, 'created_at' | 'status' | 'attempts' | 'response_code' | 'response_body' | 'last_error' | 'sent_at' | 'provider' | 'entity_type' | 'entity_id' | 'agent_id'>
      & {
        agent_id?: string | null
        provider?: MarketingProvider
        entity_type?: string | null
        entity_id?: string | null
        status?: MetaEventLogStatus
        attempts?: number
        created_at?: string
        response_code?: number | null
        response_body?: string | null
        last_error?: string | null
        sent_at?: string | null
      },
  ): MetaEventLog {
    if (!input.id || !input.org_id) throw new ValidationError('id y org_id son requeridos')
    if (!input.event_id || !input.event_name) throw new ValidationError('event_id y event_name son requeridos')
    return new MetaEventLog({
      id: input.id,
      org_id: input.org_id,
      agent_id: input.agent_id ?? null,
      provider: input.provider ?? 'meta',
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      lead_id: input.lead_id ?? null,
      event_id: input.event_id,
      event_name: input.event_name,
      status: input.status ?? 'pending',
      response_code: input.response_code ?? null,
      response_body: input.response_body ?? null,
      attempts: input.attempts ?? 0,
      last_error: input.last_error ?? null,
      sent_at: input.sent_at ?? null,
      created_at: input.created_at ?? new Date().toISOString(),
    })
  }

  static fromPersistence(props: MetaEventLogProps): MetaEventLog {
    return new MetaEventLog({ ...props })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get provider() { return this.props.provider }
  get entity_type() { return this.props.entity_type }
  get entity_id() { return this.props.entity_id }
  get lead_id() { return this.props.lead_id }
  get event_id() { return this.props.event_id }
  get event_name() { return this.props.event_name }
  get status() { return this.props.status }
  get response_code() { return this.props.response_code }
  get response_body() { return this.props.response_body }
  get attempts() { return this.props.attempts }
  get last_error() { return this.props.last_error }
  get sent_at() { return this.props.sent_at }
  get created_at() { return this.props.created_at }

  markSent(responseCode: number, responseBody: string | null): void {
    this.props.status = 'sent'
    this.props.response_code = responseCode
    this.props.response_body = responseBody
    this.props.sent_at = new Date().toISOString()
    this.props.last_error = null
  }

  markFailed(error: string, responseCode?: number, responseBody?: string | null): void {
    this.props.status = 'failed'
    this.props.last_error = error
    if (responseCode !== undefined) this.props.response_code = responseCode
    if (responseBody !== undefined) this.props.response_body = responseBody
  }

  incrementAttempts(): void {
    this.props.attempts += 1
  }

  toObject(): MetaEventLogProps {
    return { ...this.props }
  }
}
