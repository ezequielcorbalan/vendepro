import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'
import type { GoogleCalendarGateway } from '../../ports/services/google-calendar-gateway'
import type { TokenDecryptor } from './test-kiteprop-connection'
import { GOOGLE_CALENDAR_PROVIDER } from './get-google-integration'

/**
 * Desconecta Google Calendar: revoca el refresh token (best-effort) y borra
 * la integración. Los eventos ya espejados en Google no se tocan.
 */
export class DisconnectGoogleCalendarUseCase {
  constructor(
    private readonly repo: UserIntegrationRepository,
    private readonly gateway: GoogleCalendarGateway,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: { userId: string }): Promise<{ ok: boolean }> {
    const integration = await this.repo.findByUserAndProvider(input.userId, GOOGLE_CALENDAR_PROVIDER)
    if (!integration) return { ok: true }

    if (integration.credentials_encrypted) {
      const plain = await this.decryptToken(integration.credentials_encrypted)
      if (plain) {
        try {
          const creds = JSON.parse(plain) as { refresh_token?: string }
          if (creds.refresh_token) await this.gateway.revokeToken(creds.refresh_token)
        } catch {
          // credenciales ilegibles o revoke fallido: igual borramos la fila
        }
      }
    }

    await this.repo.delete(input.userId, GOOGLE_CALENDAR_PROVIDER)
    return { ok: true }
  }
}
