import { ValidationError } from '../errors/validation-error'

export interface VisitFormResponseProps {
  id: string
  form_id: string
  visitor_name: string
  visitor_phone: string | null
  visitor_email: string | null
  responses: Record<string, string>
  created_at: string
}

export class VisitFormResponse {
  private constructor(private props: VisitFormResponseProps) {}

  static create(
    props: Omit<VisitFormResponseProps, 'created_at'> & { created_at?: string }
  ): VisitFormResponse {
    if (!props.visitor_name || props.visitor_name.trim().length === 0) {
      throw new ValidationError('visitor_name es requerido', { visitor_name: 'Requerido' })
    }
    if (!props.visitor_phone && !props.visitor_email) {
      throw new ValidationError('Se requiere al menos un teléfono o email', {
        visitor_phone: 'Requerido si no hay email',
        visitor_email: 'Requerido si no hay teléfono',
      })
    }
    const now = new Date().toISOString()
    return new VisitFormResponse({
      ...props,
      created_at: props.created_at ?? now,
    })
  }

  get id() { return this.props.id }
  get form_id() { return this.props.form_id }
  get visitor_name() { return this.props.visitor_name }
  get visitor_phone() { return this.props.visitor_phone }
  get visitor_email() { return this.props.visitor_email }
  get responses() { return this.props.responses }
  get created_at() { return this.props.created_at }

  toObject(): VisitFormResponseProps {
    return { ...this.props, responses: { ...this.props.responses } }
  }
}
