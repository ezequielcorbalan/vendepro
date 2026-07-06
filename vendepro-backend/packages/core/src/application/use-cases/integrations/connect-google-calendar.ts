import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'
import type { GoogleCalendarGateway } from '../../ports/services/google-calendar-gateway'
import type { IdGenerator } from '../../ports/id-generator'
import type { TokenEncryptor } from '../marketing/save-meta-integration'
import { UserIntegration } from '../../../domain/entities/user-integration'
import { ValidationError } from '../../../domain/errors/validation-error'
import { GOOGLE_CALENDAR_PROVIDER, GetGoogleIntegrationUseCase } from './get-google-integration'
import type { GoogleIntegrationView } from './get-google-integration'

export interface ConnectGoogleCalendarInput {
  orgId: string
  userId: string
  /** Authorization code del callback OAuth. */
  code: string
  /** Debe ser exactamente el redirect_uri usado al pedir el code. */
  redirectUri: string
}

/**
 * Canjea el code OAuth por tokens y guarda las credenciales cifradas.
 * El auth URL se pide con access_type=offline + prompt=consent, así Google
 * siempre devuelve refresh_token (sin él no podemos operar en background).
 */
export class ConnectGoogleCalendarUseCase {
  constructor(
    private readonly repo: UserIntegrationRepository,
    private readonly gateway: GoogleCalendarGateway,
    private readonly ids: IdGenerator,
    private readonly encryptToken: TokenEncryptor,
  ) {}

  async execute(input: ConnectGoogleCalendarInput): Promise<GoogleIntegrationView> {
    const tokens = await this.gateway.exchangeCode(input.code, input.redirectUri)
    if (!tokens.refresh_token) {
      throw new ValidationError('Google no devolvió refresh token; reintentá la conexión')
    }

    const credentials = JSON.stringify({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      // margen de 60s para no usar un token al borde de expirar
      expires_at: new Date(Date.now() + Math.max(tokens.expires_in - 60, 0) * 1000).toISOString(),
    })

    const existing = await this.repo.findByUserAndProvider(input.userId, GOOGLE_CALENDAR_PROVIDER)
    const next = existing ?? UserIntegration.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      user_id: input.userId,
      provider: GOOGLE_CALENDAR_PROVIDER,
    })

    const cfg = next.getConfig()
    next.update({
      credentials_encrypted: await this.encryptToken(credentials),
      enabled: true,
    })
    next.setConfig({
      ...cfg,
      email: tokens.email ?? (typeof cfg.email === 'string' ? cfg.email : null),
      auto_invite: cfg.auto_invite !== false,
    })

    await this.repo.save(next)
    return new GetGoogleIntegrationUseCase(this.repo).execute({ userId: input.userId })
  }
}
