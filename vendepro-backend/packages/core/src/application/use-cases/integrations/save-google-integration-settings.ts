import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'
import { GOOGLE_CALENDAR_PROVIDER, GetGoogleIntegrationUseCase } from './get-google-integration'
import type { GoogleIntegrationView } from './get-google-integration'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface SaveGoogleIntegrationSettingsInput {
  userId: string
  enabled?: boolean
  auto_invite?: boolean
}

/** Ajustes de la conexión existente (PATCH semántico: undefined preserva). */
export class SaveGoogleIntegrationSettingsUseCase {
  constructor(private readonly repo: UserIntegrationRepository) {}

  async execute(input: SaveGoogleIntegrationSettingsInput): Promise<GoogleIntegrationView> {
    const integration = await this.repo.findByUserAndProvider(input.userId, GOOGLE_CALENDAR_PROVIDER)
    if (!integration) throw new NotFoundError('Integración Google Calendar', input.userId)

    if (input.enabled !== undefined) integration.update({ enabled: input.enabled })
    if (input.auto_invite !== undefined) {
      integration.setConfig({ ...integration.getConfig(), auto_invite: input.auto_invite })
    }

    await this.repo.save(integration)
    return new GetGoogleIntegrationUseCase(this.repo).execute({ userId: input.userId })
  }
}
