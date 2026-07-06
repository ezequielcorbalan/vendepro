import { ValidationError } from '../errors/validation-error'

export type SuppressionReason = 'unsubscribe' | 'bounce' | 'complaint' | 'manual'

export interface EmailSuppressionProps {
  id: string
  org_id: string
  email: string
  reason: SuppressionReason
  source: string | null
  created_at: string
}

export class EmailSuppression {
  private constructor(private props: EmailSuppressionProps) {}

  static create(
    input: Omit<EmailSuppressionProps, 'created_at' | 'reason' | 'source'> & {
      reason?: SuppressionReason
      source?: string | null
      created_at?: string
    },
  ): EmailSuppression {
    if (!input.org_id || input.org_id.trim().length === 0) {
      throw new ValidationError('org_id es requerido')
    }
    const email = (input.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      throw new ValidationError('email inválido')
    }
    return new EmailSuppression({
      id: input.id,
      org_id: input.org_id,
      email,
      reason: input.reason ?? 'unsubscribe',
      source: input.source ?? null,
      created_at: input.created_at ?? new Date().toISOString(),
    })
  }

  static fromPersistence(props: EmailSuppressionProps): EmailSuppression {
    return new EmailSuppression({ ...props })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get email() { return this.props.email }
  get reason() { return this.props.reason }
  get source() { return this.props.source }
  get created_at() { return this.props.created_at }

  toObject(): EmailSuppressionProps {
    return { ...this.props }
  }
}
