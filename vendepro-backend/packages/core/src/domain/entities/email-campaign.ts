import { ValidationError } from '../errors/validation-error'

export type EmailCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'

/**
 * Criterio de audiencia. Se resuelve al momento de encolar el envío
 * (no es una lista congelada): la lista de supresión siempre se
 * aplica con el estado actual.
 */
export interface CampaignSegment {
  /** Origen de los destinatarios. */
  source: 'contacts' | 'leads'
  /** Filtro para contacts: propietario | comprador | inversor | ... */
  contact_type?: string | null
  /** Filtro para leads: stages incluidos (vacío = todos). */
  stages?: string[] | null
}

export interface EmailCampaignProps {
  id: string
  org_id: string
  name: string
  subject: string | null
  preheader: string | null
  html: string | null
  text: string | null
  segment_json: string | null
  status: EmailCampaignStatus
  scheduled_at: string | null
  total_recipients: number
  sent_count: number
  failed_count: number
  created_by: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export class EmailCampaign {
  private constructor(private props: EmailCampaignProps) {}

  static create(
    input: Pick<EmailCampaignProps, 'id' | 'org_id' | 'name'> &
      Partial<Omit<EmailCampaignProps, 'id' | 'org_id' | 'name' | 'status'>>,
  ): EmailCampaign {
    if (!input.org_id?.trim()) throw new ValidationError('org_id es requerido')
    if (!input.name?.trim()) throw new ValidationError('El nombre de la campaña es requerido')
    const now = new Date().toISOString()
    return new EmailCampaign({
      id: input.id,
      org_id: input.org_id,
      name: input.name.trim(),
      subject: input.subject ?? null,
      preheader: input.preheader ?? null,
      html: input.html ?? null,
      text: input.text ?? null,
      segment_json: input.segment_json ?? null,
      status: 'draft',
      scheduled_at: input.scheduled_at ?? null,
      total_recipients: 0,
      sent_count: 0,
      failed_count: 0,
      created_by: input.created_by ?? null,
      sent_at: null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: EmailCampaignProps): EmailCampaign {
    return new EmailCampaign({ ...props })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get subject() { return this.props.subject }
  get preheader() { return this.props.preheader }
  get html() { return this.props.html }
  get text() { return this.props.text }
  get segment_json() { return this.props.segment_json }
  get status() { return this.props.status }
  get scheduled_at() { return this.props.scheduled_at }
  get total_recipients() { return this.props.total_recipients }
  get sent_count() { return this.props.sent_count }
  get failed_count() { return this.props.failed_count }
  get created_by() { return this.props.created_by }
  get sent_at() { return this.props.sent_at }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  get segment(): CampaignSegment | null {
    if (!this.props.segment_json) return null
    try {
      return JSON.parse(this.props.segment_json) as CampaignSegment
    } catch {
      return null
    }
  }

  get isEditable(): boolean {
    return this.props.status === 'draft'
  }

  /** Validación previa al encolado: contenido completo. */
  assertReadyToSend(): void {
    if (this.props.status !== 'draft' && this.props.status !== 'scheduled') {
      throw new ValidationError(`La campaña ya está en estado '${this.props.status}'`)
    }
    if (!this.props.subject?.trim()) throw new ValidationError('La campaña no tiene asunto')
    if (!this.props.html?.trim()) throw new ValidationError('La campaña no tiene contenido')
    if (!this.segment) throw new ValidationError('La campaña no tiene audiencia definida')
  }

  update(patch: Partial<Omit<EmailCampaignProps, 'id' | 'org_id' | 'created_at'>>): void {
    if (patch.name !== undefined && !patch.name?.trim()) {
      throw new ValidationError('El nombre de la campaña es requerido')
    }
    Object.assign(this.props, patch)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): EmailCampaignProps {
    return { ...this.props }
  }
}
