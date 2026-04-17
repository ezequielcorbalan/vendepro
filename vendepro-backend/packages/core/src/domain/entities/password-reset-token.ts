import { ValidationError } from '../errors/validation-error'

export interface PasswordResetTokenProps {
  token: string
  user_id: string
  org_id: string
  expires_at: string
  used: boolean
  created_at: string
}

export class PasswordResetToken {
  private constructor(private props: PasswordResetTokenProps) {}

  static create(
    props: Omit<PasswordResetTokenProps, 'created_at'> & { created_at?: string }
  ): PasswordResetToken {
    if (!props.token || props.token.length < 32) {
      throw new ValidationError('Token inválido (mín. 32 caracteres)', { token: 'Formato inválido' })
    }
    const now = new Date().toISOString()
    return new PasswordResetToken({
      ...props,
      created_at: props.created_at ?? now,
    })
  }

  get token() { return this.props.token }
  get user_id() { return this.props.user_id }
  get org_id() { return this.props.org_id }
  get expires_at() { return this.props.expires_at }
  get used() { return this.props.used }
  get created_at() { return this.props.created_at }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() > new Date(this.props.expires_at).getTime()
  }

  canBeUsed(now: Date = new Date()): boolean {
    return !this.props.used && !this.isExpired(now)
  }

  markUsed(): PasswordResetToken {
    return new PasswordResetToken({ ...this.props, used: true })
  }

  toObject(): PasswordResetTokenProps {
    return { ...this.props }
  }
}
