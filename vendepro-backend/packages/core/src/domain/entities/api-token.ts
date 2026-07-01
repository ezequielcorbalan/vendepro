import { ValidationError } from '../errors/validation-error'

export interface ApiTokenProps {
  id: string
  org_id: string
  name: string
  scopes: string[]
  prefix: string | null
  created_by: string | null
  is_active: boolean
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export class ApiToken {
  private constructor(private props: ApiTokenProps) {}

  static create(
    props: Omit<ApiTokenProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string },
  ): ApiToken {
    if (!props.name || props.name.trim().length < 2) {
      throw new ValidationError('El nombre del token es requerido (mín. 2 caracteres)', { name: 'Requerido' })
    }
    if (!props.scopes || props.scopes.length === 0) {
      throw new ValidationError('Al menos un scope es requerido', { scopes: 'Requerido' })
    }
    const now = new Date().toISOString()
    return new ApiToken({
      ...props,
      name: props.name.trim(),
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  // ── Getters ──────────────────────────────────────────
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get scopes() { return this.props.scopes }
  get prefix() { return this.props.prefix }
  get created_by() { return this.props.created_by }
  get is_active() { return this.props.is_active }
  get last_used_at() { return this.props.last_used_at }
  get revoked_at() { return this.props.revoked_at }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  // ── Domain Methods ──────────────────────────────────
  hasScope(scope: string): boolean {
    return this.props.scopes.includes(scope)
  }

  revoke(): void {
    this.props.is_active = false
    this.props.revoked_at = new Date().toISOString()
    this.props.updated_at = this.props.revoked_at
  }

  toObject(): ApiTokenProps {
    return { ...this.props }
  }
}
