import { ValidationError } from '../errors/validation-error'

export const LEAD_PROPERTY_STATUSES = [
  'interesado',
  'visita_agendada',
  'visitada',
  'descartada',
  'oferto',
] as const
export type LeadPropertyStatus = typeof LEAD_PROPERTY_STATUSES[number]

export interface LeadPropertyProps {
  id: string
  org_id: string
  lead_id: string
  property_id: string
  status: LeadPropertyStatus
  notes: string | null
  feedback: string | null
  created_at: string
  updated_at: string
}

/**
 * Propiedad de interés de un lead (comprador): la relación M:N lead ↔ propiedad
 * con su estado operativo. El status es una etiqueta corregible (sin máquina de
 * transiciones): interesado → visita_agendada → visitada → descartada/oferto,
 * pero el agente puede moverla libremente.
 */
export class LeadProperty {
  private constructor(private props: LeadPropertyProps) {}

  static create(
    props: Omit<LeadPropertyProps, 'status' | 'created_at' | 'updated_at'> & {
      status?: LeadPropertyStatus
      created_at?: string
      updated_at?: string
    },
  ): LeadProperty {
    if (!props.org_id) throw new ValidationError('org_id es requerido', { org_id: 'Requerido' })
    if (!props.lead_id) throw new ValidationError('lead_id es requerido', { lead_id: 'Requerido' })
    if (!props.property_id) {
      throw new ValidationError('property_id es requerido', { property_id: 'Requerido' })
    }
    const status = props.status ?? 'interesado'
    if (!LEAD_PROPERTY_STATUSES.includes(status)) {
      throw new ValidationError(
        `Status inválido: "${status}". Permitidos: ${LEAD_PROPERTY_STATUSES.join(', ')}`,
      )
    }
    const now = new Date().toISOString()
    return new LeadProperty({
      ...props,
      status,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get lead_id() { return this.props.lead_id }
  get property_id() { return this.props.property_id }
  get status() { return this.props.status }
  get notes() { return this.props.notes }
  get feedback() { return this.props.feedback }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  updateStatus(status: LeadPropertyStatus, feedback?: string | null): void {
    if (!LEAD_PROPERTY_STATUSES.includes(status)) {
      throw new ValidationError(
        `Status inválido: "${status}". Permitidos: ${LEAD_PROPERTY_STATUSES.join(', ')}`,
      )
    }
    this.props.status = status
    if (feedback !== undefined) this.props.feedback = feedback
    this.props.updated_at = new Date().toISOString()
  }

  setFeedback(feedback: string | null): void {
    this.props.feedback = feedback
    this.props.updated_at = new Date().toISOString()
  }

  setNotes(notes: string | null): void {
    this.props.notes = notes
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): LeadPropertyProps {
    return { ...this.props }
  }
}
