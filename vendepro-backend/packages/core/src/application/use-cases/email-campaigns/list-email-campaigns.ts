import type { EmailCampaignRepository } from '../../ports/repositories/email-campaign-repository'
import type { EmailCampaign } from '../../../domain/entities/email-campaign'

export class ListEmailCampaignsUseCase {
  constructor(private readonly repo: EmailCampaignRepository) {}

  async execute(orgId: string, limit = 50): Promise<EmailCampaign[]> {
    return this.repo.listByOrg(orgId, limit)
  }
}
