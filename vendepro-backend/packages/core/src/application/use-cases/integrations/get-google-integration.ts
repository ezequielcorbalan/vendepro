import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'

export const GOOGLE_CALENDAR_PROVIDER = 'google_calendar'

export interface GoogleIntegrationView {
  connected: boolean
  enabled: boolean
  /** Invitar automáticamente al cliente (email como attendee) al crear eventos. */
  auto_invite: boolean
  email: string | null
  last_sync_at: string | null
}

/** Estado de la conexión Google Calendar del usuario (sin credenciales). */
export class GetGoogleIntegrationUseCase {
  constructor(private readonly repo: UserIntegrationRepository) {}

  async execute(input: { userId: string }): Promise<GoogleIntegrationView> {
    const integration = await this.repo.findByUserAndProvider(input.userId, GOOGLE_CALENDAR_PROVIDER)
    if (!integration) {
      return { connected: false, enabled: false, auto_invite: true, email: null, last_sync_at: null }
    }
    const cfg = integration.getConfig()
    return {
      connected: !!integration.credentials_encrypted,
      enabled: integration.enabled,
      auto_invite: cfg.auto_invite !== false,
      email: typeof cfg.email === 'string' ? cfg.email : null,
      last_sync_at: integration.last_sync_at,
    }
  }
}
