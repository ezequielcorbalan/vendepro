import { ValidationError } from '../errors/validation-error'

export interface UserIntegrationProps {
  id: string
  org_id: string
  user_id: string
  provider: string // 'google_calendar' (extensible a otros providers por usuario)
  // JSON cifrado con los tokens OAuth: { refresh_token, access_token, expires_at, email }
  credentials_encrypted: string | null
  // JSON de estado/config no sensible, ej: { email?: string, auto_invite?: boolean }
  config_json: string | null
  enabled: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export class UserIntegration {
  private constructor(private props: UserIntegrationProps) {}

  static create(
    input: Omit<UserIntegrationProps, 'created_at' | 'updated_at' | 'enabled' | 'credentials_encrypted' | 'config_json' | 'last_sync_at'> & {
      credentials_encrypted?: string | null
      config_json?: string | null
      enabled?: boolean
      last_sync_at?: string | null
      created_at?: string
      updated_at?: string
    },
  ): UserIntegration {
    if (!input.org_id || input.org_id.trim().length === 0) {
      throw new ValidationError('org_id es requerido')
    }
    if (!input.user_id || input.user_id.trim().length === 0) {
      throw new ValidationError('user_id es requerido')
    }
    if (!input.provider || input.provider.trim().length === 0) {
      throw new ValidationError('provider es requerido')
    }
    const now = new Date().toISOString()
    return new UserIntegration({
      id: input.id,
      org_id: input.org_id,
      user_id: input.user_id,
      provider: input.provider,
      credentials_encrypted: input.credentials_encrypted ?? null,
      config_json: input.config_json ?? null,
      enabled: input.enabled ?? false,
      last_sync_at: input.last_sync_at ?? null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: UserIntegrationProps): UserIntegration {
    return new UserIntegration({ ...props })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get user_id() { return this.props.user_id }
  get provider() { return this.props.provider }
  get credentials_encrypted() { return this.props.credentials_encrypted }
  get config_json() { return this.props.config_json }
  get enabled() { return this.props.enabled }
  get last_sync_at() { return this.props.last_sync_at }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  update(patch: Partial<Omit<UserIntegrationProps, 'id' | 'org_id' | 'user_id' | 'provider' | 'created_at'>>): void {
    Object.assign(this.props, patch)
    this.props.updated_at = new Date().toISOString()
  }

  /** Config parseada (best-effort: JSON inválido devuelve {}). */
  getConfig(): Record<string, unknown> {
    if (!this.props.config_json) return {}
    try {
      const parsed = JSON.parse(this.props.config_json)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  setConfig(config: Record<string, unknown>): void {
    this.update({ config_json: JSON.stringify(config) })
  }

  // Vista pública: nunca se exponen los tokens en plaintext ni cifrados.
  toPublicView(): Omit<UserIntegrationProps, 'credentials_encrypted'> & { connected: boolean } {
    const { credentials_encrypted, ...rest } = this.props
    return { ...rest, connected: !!credentials_encrypted }
  }

  toObject(): UserIntegrationProps {
    return { ...this.props }
  }
}
