import { ValidationError } from '../errors/validation-error'

export interface MetaIntegrationProps {
  /** Identidad: la config es por agente/usuario (no por org). */
  agent_id: string
  /** Org a la que pertenece el agente (multi-tenant / referencia). */
  org_id: string
  pixel_id: string | null
  access_token_encrypted: string | null
  stape_endpoint: string | null
  gtm_container_id: string | null
  test_event_code: string | null
  /** Ad Account de Meta (act_XXXX) — habilita lectura de campañas (ads_read). */
  ad_account_id: string | null
  enabled: boolean
  // GA4 Measurement Protocol (server-side) — opcional, se fan-out via
  // el mismo stape_endpoint si está configurado.
  ga4_measurement_id: string | null
  ga4_api_secret_encrypted: string | null
  ga4_enabled: boolean
  created_at: string
  updated_at: string
}

export class MetaIntegration {
  private constructor(private props: MetaIntegrationProps) {}

  static create(
    input: Omit<MetaIntegrationProps, 'created_at' | 'updated_at' | 'enabled' | 'ga4_enabled'> & {
      enabled?: boolean
      ga4_enabled?: boolean
      created_at?: string
      updated_at?: string
    },
  ): MetaIntegration {
    if (!input.agent_id || input.agent_id.trim().length === 0) {
      throw new ValidationError('agent_id es requerido')
    }
    if (!input.org_id || input.org_id.trim().length === 0) {
      throw new ValidationError('org_id es requerido')
    }
    const now = new Date().toISOString()
    return new MetaIntegration({
      agent_id: input.agent_id,
      org_id: input.org_id,
      pixel_id: input.pixel_id ?? null,
      access_token_encrypted: input.access_token_encrypted ?? null,
      stape_endpoint: input.stape_endpoint ?? null,
      gtm_container_id: input.gtm_container_id ?? null,
      test_event_code: input.test_event_code ?? null,
      ad_account_id: input.ad_account_id ?? null,
      enabled: input.enabled ?? false,
      ga4_measurement_id: input.ga4_measurement_id ?? null,
      ga4_api_secret_encrypted: input.ga4_api_secret_encrypted ?? null,
      ga4_enabled: input.ga4_enabled ?? false,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: MetaIntegrationProps): MetaIntegration {
    return new MetaIntegration({ ...props })
  }

  // Getters
  get agent_id() { return this.props.agent_id }
  get org_id() { return this.props.org_id }
  get pixel_id() { return this.props.pixel_id }
  get access_token_encrypted() { return this.props.access_token_encrypted }
  get stape_endpoint() { return this.props.stape_endpoint }
  get gtm_container_id() { return this.props.gtm_container_id }
  get test_event_code() { return this.props.test_event_code }
  get ad_account_id() { return this.props.ad_account_id }
  get enabled() { return this.props.enabled }
  get ga4_measurement_id() { return this.props.ga4_measurement_id }
  get ga4_api_secret_encrypted() { return this.props.ga4_api_secret_encrypted }
  get ga4_enabled() { return this.props.ga4_enabled }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  update(patch: Partial<Omit<MetaIntegrationProps, 'agent_id' | 'org_id' | 'created_at'>>): void {
    Object.assign(this.props, patch)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): MetaIntegrationProps {
    return { ...this.props }
  }

  // Vista pública: nunca se expone tokens/api_secret en plaintext.
  toPublicView(): Omit<MetaIntegrationProps, 'access_token_encrypted' | 'ga4_api_secret_encrypted'>
    & { has_access_token: boolean; has_ga4_api_secret: boolean } {
    const { access_token_encrypted, ga4_api_secret_encrypted, ...rest } = this.props
    return {
      ...rest,
      has_access_token: !!access_token_encrypted,
      has_ga4_api_secret: !!ga4_api_secret_encrypted,
    }
  }
}
