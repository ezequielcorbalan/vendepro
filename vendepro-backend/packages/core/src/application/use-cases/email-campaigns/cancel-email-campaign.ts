import type { EmailCampaignRepository, EmailCampaignSendRepository } from '../../ports/repositories/email-campaign-repository'
import { ValidationError } from '../../../domain/errors/validation-error'
import { NotFoundError } from '../../../domain/errors/not-found'

/**
 * Cancela una campaña programada: vacía la cola y la devuelve a draft
 * (la audiencia se recongela al re-encolar, con supresiones al día).
 */
export class CancelEmailCampaignUseCase {
  constructor(
    private readonly campaignRepo: EmailCampaignRepository,
    private readonly sendRepo: EmailCampaignSendRepository,
  ) {}

  async execute(id: string, orgId: string): Promise<{ ok: true }> {
    const campaign = await this.campaignRepo.findById(id, orgId)
    if (!campaign) throw new NotFoundError('Campaña no encontrada')
    if (campaign.status !== 'scheduled') {
      throw new ValidationError(`Solo se puede cancelar una campaña programada (estado actual: '${campaign.status}')`)
    }
    await this.sendRepo.deleteByCampaign(id, orgId)
    campaign.update({ status: 'draft', scheduled_at: null, total_recipients: 0 })
    await this.campaignRepo.save(campaign)
    return { ok: true }
  }
}
