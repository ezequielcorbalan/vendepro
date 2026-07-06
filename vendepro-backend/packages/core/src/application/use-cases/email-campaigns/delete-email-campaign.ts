import type { EmailCampaignRepository, EmailCampaignSendRepository } from '../../ports/repositories/email-campaign-repository'
import { ValidationError } from '../../../domain/errors/validation-error'
import { NotFoundError } from '../../../domain/errors/not-found'

export class DeleteEmailCampaignUseCase {
  constructor(
    private readonly campaignRepo: EmailCampaignRepository,
    private readonly sendRepo: EmailCampaignSendRepository,
  ) {}

  async execute(id: string, orgId: string): Promise<{ ok: true }> {
    const campaign = await this.campaignRepo.findById(id, orgId)
    if (!campaign) throw new NotFoundError('Campaña no encontrada')
    if (campaign.status === 'sending') {
      throw new ValidationError('No se puede borrar una campaña en pleno envío')
    }
    await this.sendRepo.deleteByCampaign(id, orgId)
    await this.campaignRepo.delete(id, orgId)
    return { ok: true }
  }
}
