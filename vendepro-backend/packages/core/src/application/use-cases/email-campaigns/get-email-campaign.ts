import type { EmailCampaignRepository, EmailCampaignSendRepository, CampaignSendRow } from '../../ports/repositories/email-campaign-repository'
import type { EmailCampaignProps } from '../../../domain/entities/email-campaign'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface GetEmailCampaignResult extends EmailCampaignProps {
  sends: CampaignSendRow[]
}

export class GetEmailCampaignUseCase {
  constructor(
    private readonly campaignRepo: EmailCampaignRepository,
    private readonly sendRepo: EmailCampaignSendRepository,
  ) {}

  async execute(id: string, orgId: string, sendsLimit = 200): Promise<GetEmailCampaignResult> {
    const campaign = await this.campaignRepo.findById(id, orgId)
    if (!campaign) throw new NotFoundError('Campaña no encontrada')
    const sends = await this.sendRepo.listByCampaign(id, orgId, sendsLimit)
    return { ...campaign.toObject(), sends }
  }
}
