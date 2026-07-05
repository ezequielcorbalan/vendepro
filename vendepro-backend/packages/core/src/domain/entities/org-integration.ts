import { ValidationError } from '../errors/validation-error'

export interface OrgIntegrationProps {
  id: string
  org_id: string
  provider: string // 'kiteprop' (extensible a otros CRMs)
  name: string | null
  credentials_encrypted: string | null
  // JSON de estado/config no sensible, ej: { backfill_next_page?: number, backfill_done?: boolean }
  config_json: string | null
  enabled: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export class OrgIntegration {
  private constructor(private props: OrgIntegrationProps) {}

  static create(
    input: Omit<OrgIntegrationProps, 'created_at' | 'updated_at' | 'enabled' | 'name' | 'credentials_encrypted' | 'config_json' | 'last_sync_at'> & {
      name?: string | null
      credentials_encrypted?: string | null
      config_json?: string | null
      enabled?: boolean
      last_sync_at?: string | null
      created_at?: string
      updated_at?: string
    },
  ): OrgIntegration {
    if (!input.org_id || input.org_id.trim().length === 0) {
      throw new ValidationError('org_id es requerido')
    }
    if (!input.provider || input.provider.trim().length === 0) {
      throw new ValidationError('provider es requerido')
    }
    const now = new Date().toISOString()
    return new OrgIntegration({
      id: input.id,
      org_id: input.org_id,
      provider: input.provider,
      name: input.name ?? null,
      credentials_encrypted: input.credentials_encrypted ?? null,
      config_json: input.config_json ?? null,
      enabled: input.enabled ?? false,
      last_sync_at: input.last_sync_at ?? null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: OrgIntegrationProps): OrgIntegration {
    return new OrgIntegration({ ...props })
  }

  // Getters
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get provider() { return this.props.provider }
  get name() { return this.props.name }
  get credentials_encrypted() { return this.props.credentials_encrypted }
  get config_json() { return this.props.config_json }
  get enabled() { return this.props.enabled }
  get last_sync_at() { return this.props.last_sync_at }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  update(patch: Partial<Omit<OrgIntegrationProps, 'id' | 'org_id' | 'provider' | 'created_at'>>): void {
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

  toObject(): OrgIntegrationProps {
    return { ...this.props }
  }

  // Vista pública: nunca se exponen credenciales en plaintext ni cifradas.
  toPublicView(): Omit<OrgIntegrationProps, 'credentials_encrypted'> & { has_api_key: boolean } {
    const { credentials_encrypted, ...rest } = this.props
    return { ...rest, has_api_key: !!credentials_encrypted }
  }
}
