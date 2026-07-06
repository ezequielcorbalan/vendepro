import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import type { EmailSettingsProps } from '../../../domain/entities/email-settings'

export type GetEmailSettingsResult =
  | (EmailSettingsProps & { configured: true })
  | { configured: false }

export class GetEmailSettingsUseCase {
  constructor(private readonly repo: EmailSettingsRepository) {}

  async execute(orgId: string): Promise<GetEmailSettingsResult> {
    const settings = await this.repo.findByOrg(orgId)
    if (!settings) return { configured: false }
    return { ...settings.toObject(), configured: true }
  }
}
