import { ValidationError } from '../errors/validation-error'

export interface ContactProps {
  id: string
  org_id: string
  full_name: string
  phone: string | null
  email: string | null
  contact_type: string
  neighborhood: string | null
  notes: string | null
  source: string | null
  agent_id: string
  /** IGSID / PSID: cómo se reconoce a la persona cuando no hay teléfono. */
  meta_user_id?: string | null
  ig_username?: string | null
  created_at: string
}

export class Contact {
  private constructor(private props: ContactProps) {}

  static create(props: Omit<ContactProps, 'created_at'> & { created_at?: string }): Contact {
    if (!props.full_name?.trim()) throw new ValidationError('Nombre es requerido')
    if (props.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new ValidationError('Email no válido')
    }
    return new Contact({ ...props, created_at: props.created_at ?? new Date().toISOString() })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get full_name() { return this.props.full_name }
  get phone() { return this.props.phone }
  get email() { return this.props.email }
  get contact_type() { return this.props.contact_type }
  get neighborhood() { return this.props.neighborhood }
  get notes() { return this.props.notes }
  get source() { return this.props.source }
  get meta_user_id() { return this.props.meta_user_id ?? null }
  get ig_username() { return this.props.ig_username ?? null }
  get agent_id() { return this.props.agent_id }
  get created_at() { return this.props.created_at }

  toObject(): ContactProps { return { ...this.props } }
}
