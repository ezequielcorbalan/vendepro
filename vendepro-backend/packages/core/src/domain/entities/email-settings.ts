import { ValidationError } from '../errors/validation-error'

export type EmailDomainStatus = 'unverified' | 'pending' | 'verified' | 'failed'

export interface EmailSettingsProps {
  org_id: string
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  enabled: boolean
  // Verificación de dominio en Resend (cuenta plataforma, dominio por org)
  resend_domain_id: string | null
  domain_status: EmailDomainStatus
  created_at: string
  updated_at: string
}

export class EmailSettings {
  private constructor(private props: EmailSettingsProps) {}

  static create(
    input: Omit<EmailSettingsProps, 'created_at' | 'updated_at' | 'enabled' | 'domain_status'> & {
      enabled?: boolean
      domain_status?: EmailDomainStatus
      created_at?: string
      updated_at?: string
    },
  ): EmailSettings {
    if (!input.org_id || input.org_id.trim().length === 0) {
      throw new ValidationError('org_id es requerido')
    }
    const now = new Date().toISOString()
    return new EmailSettings({
      org_id: input.org_id,
      from_name: input.from_name ?? null,
      from_email: input.from_email ?? null,
      reply_to: input.reply_to ?? null,
      enabled: input.enabled ?? false,
      resend_domain_id: input.resend_domain_id ?? null,
      domain_status: input.domain_status ?? 'unverified',
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: EmailSettingsProps): EmailSettings {
    return new EmailSettings({ ...props })
  }

  // Getters
  get org_id() { return this.props.org_id }
  get from_name() { return this.props.from_name }
  get from_email() { return this.props.from_email }
  get reply_to() { return this.props.reply_to }
  get enabled() { return this.props.enabled }
  get resend_domain_id() { return this.props.resend_domain_id }
  get domain_status() { return this.props.domain_status }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  /** Listo para enviar: remitente configurado y habilitado. */
  get isReadyToSend(): boolean {
    return this.props.enabled && !!this.props.from_email
  }

  update(patch: Partial<Omit<EmailSettingsProps, 'org_id' | 'created_at'>>): void {
    Object.assign(this.props, patch)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): EmailSettingsProps {
    return { ...this.props }
  }
}
