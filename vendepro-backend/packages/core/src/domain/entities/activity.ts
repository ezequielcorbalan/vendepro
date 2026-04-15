import { ValidationError } from '../errors/validation-error'

export type ActivityType = 'llamada' | 'whatsapp' | 'reunion' | 'visita_captacion' | 'visita_comprador' | 'tasacion' | 'presentacion' | 'seguimiento' | 'documentacion' | 'admin' | 'cierre'
const VALID_TYPES: ActivityType[] = ['llamada', 'whatsapp', 'reunion', 'visita_captacion', 'visita_comprador', 'tasacion', 'presentacion', 'seguimiento', 'documentacion', 'admin', 'cierre']

export interface ActivityProps {
  id: string
  org_id: string
  agent_id: string
  activity_type: ActivityType
  description: string | null
  result: string | null
  duration_minutes: number | null
  lead_id: string | null
  contact_id: string | null
  property_id: string | null
  appraisal_id: string | null
  created_at: string
  // Joined
  agent_name?: string
  lead_name?: string
}

export class Activity {
  private constructor(private props: ActivityProps) {}

  static create(props: Omit<ActivityProps, 'created_at'> & { created_at?: string }): Activity {
    if (!VALID_TYPES.includes(props.activity_type)) {
      throw new ValidationError(`Tipo de actividad inválido: "${props.activity_type}"`)
    }
    return new Activity({ ...props, created_at: props.created_at ?? new Date().toISOString() })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get activity_type() { return this.props.activity_type }
  get description() { return this.props.description }
  get result() { return this.props.result }
  get duration_minutes() { return this.props.duration_minutes }
  get lead_id() { return this.props.lead_id }
  get contact_id() { return this.props.contact_id }
  get property_id() { return this.props.property_id }
  get appraisal_id() { return this.props.appraisal_id }
  get created_at() { return this.props.created_at }
  get agent_name() { return this.props.agent_name }
  get lead_name() { return this.props.lead_name }

  toObject(): ActivityProps { return { ...this.props } }
}
