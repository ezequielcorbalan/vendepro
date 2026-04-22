import { ValidationError } from '../errors/validation-error'

export interface MetaIntegrationProps {
  org_id: string
  pixel_id: string | null
  access_token_encrypted: string | null
  stape_endpoint: string | null
  gtm_container_id: string | null
  test_event_code: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export class MetaIntegration {
  private constructor(private props: MetaIntegrationProps) {}

  static create(
    input: Omit<MetaIntegrationProps, 'created_at' | 'updated_at' | 'enabled'> & {
      enabled?: boolean
      created_at?: string
      updated_at?: string
    },
  ): MetaIntegration {
    if (!input.org_id || input.org_id.trim().length === 0) {
      throw new ValidationError('org_id es requerido')
    }
    const now = new Date().toISOString()
    return new MetaIntegration({
      org_id: input.org_id,
      pixel_id: input.pixel_id ?? null,
      access_token_encrypted: input.access_token_encrypted ?? null,
      stape_endpoint: input.stape_endpoint ?? null,
      gtm_container_id: input.gtm_container_id ?? null,
      test_event_code: input.test_event_code ?? null,
      enabled: input.enabled ?? false,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: MetaIntegrationProps): MetaIntegration {
    return new MetaIntegration({ ...props })
  }

  // Getters
  get org_id() { return this.props.org_id }
  get pixel_id() { return this.props.pixel_id }
  get access_token_encrypted() { return this.props.access_token_encrypted }
  get stape_endpoint() { return this.props.stape_endpoint }
  get gtm_container_id() { return this.props.gtm_container_id }
  get test_event_code() { return this.props.test_event_code }
  get enabled() { return this.props.enabled }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  update(patch: Partial<Omit<MetaIntegrationProps, 'org_id' | 'created_at'>>): void {
    Object.assign(this.props, patch)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): MetaIntegrationProps {
    return { ...this.props }
  }

  // Public-safe view: token nunca se expone en plaintext.
  toPublicView(): Omit<MetaIntegrationProps, 'access_token_encrypted'> & { has_access_token: boolean } {
    const { access_token_encrypted, ...rest } = this.props
    return { ...rest, has_access_token: !!access_token_encrypted }
  }
}
