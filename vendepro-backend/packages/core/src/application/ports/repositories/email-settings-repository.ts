import type { EmailSettings } from '../../../domain/entities/email-settings'

export interface EmailSettingsRepository {
  findByOrg(orgId: string): Promise<EmailSettings | null>
  save(settings: EmailSettings): Promise<void>
}
