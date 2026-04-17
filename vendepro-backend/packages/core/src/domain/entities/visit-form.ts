import { ValidationError } from '../errors/validation-error'

export interface VisitFormField {
  key: string
  label: string
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea'
  required: boolean
  options?: string[]
}

export interface VisitFormProps {
  id: string
  org_id: string
  property_id: string
  public_slug: string
  fields: VisitFormField[]
  created_at: string
  updated_at: string
}

export class VisitForm {
  private constructor(private props: VisitFormProps) {}

  static create(
    props: Omit<VisitFormProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
  ): VisitForm {
    if (!props.public_slug || props.public_slug.trim().length === 0) {
      throw new ValidationError('public_slug es requerido', { public_slug: 'Requerido' })
    }
    if (!/^[a-z0-9-]+$/i.test(props.public_slug)) {
      throw new ValidationError('public_slug inválido (sólo letras, dígitos y guiones)', {
        public_slug: 'Formato inválido',
      })
    }
    if (!Array.isArray(props.fields) || props.fields.length === 0) {
      throw new ValidationError('fields es requerido (al menos un campo)', { fields: 'Requerido' })
    }
    const now = new Date().toISOString()
    return new VisitForm({
      ...props,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get property_id() { return this.props.property_id }
  get public_slug() { return this.props.public_slug }
  get fields() { return this.props.fields }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): VisitFormProps {
    return { ...this.props, fields: this.props.fields.map((f) => ({ ...f })) }
  }
}
