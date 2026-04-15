import { ValidationError } from '../errors/validation-error'
import type { UserRole } from '../rules/role-rules'

export interface UserProps {
  id: string
  email: string
  password_hash: string
  full_name: string
  phone: string | null
  photo_url: string | null
  role: UserRole
  org_id: string | null
  active: number
  created_at: string
}

const VALID_ROLES: UserRole[] = ['owner', 'admin', 'supervisor', 'agent']

export class User {
  private constructor(private props: UserProps) {}

  static create(props: Omit<UserProps, 'created_at'> & { created_at?: string }): User {
    if (!props.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new ValidationError('Email inválido', { email: 'Formato inválido' })
    }
    if (!props.full_name?.trim()) {
      throw new ValidationError('Nombre completo es requerido', { full_name: 'Requerido' })
    }
    if (!VALID_ROLES.includes(props.role)) {
      throw new ValidationError(`Rol inválido: "${props.role}"`)
    }
    return new User({
      ...props,
      email: props.email.toLowerCase().trim(),
      active: props.active ?? 1,
      created_at: props.created_at ?? new Date().toISOString(),
    })
  }

  get id() { return this.props.id }
  get email() { return this.props.email }
  get password_hash() { return this.props.password_hash }
  get full_name() { return this.props.full_name }
  get name() { return this.props.full_name }
  get phone() { return this.props.phone }
  get photo_url() { return this.props.photo_url }
  get role() { return this.props.role }
  get org_id() { return this.props.org_id }
  get active() { return this.props.active }
  get created_at() { return this.props.created_at }

  isAdmin(): boolean {
    return this.props.role === 'admin' || this.props.role === 'owner'
  }

  updatePassword(newHash: string): void {
    this.props.password_hash = newHash
  }

  deactivate(): void {
    this.props.active = 0
  }

  toObject(): UserProps {
    return { ...this.props }
  }
}
