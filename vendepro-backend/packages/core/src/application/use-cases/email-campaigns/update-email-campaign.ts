import type { EmailCampaignRepository } from '../../ports/repositories/email-campaign-repository'
import type { CampaignSegment } from '../../../domain/entities/email-campaign'
import { ValidationError } from '../../../domain/errors/validation-error'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdateEmailCampaignInput {
  id: string
  orgId: string
  name?: string
  subject?: string | null
  preheader?: string | null
  html?: string | null
  text?: string | null
  segment?: CampaignSegment | null
  scheduled_at?: string | null
}

export class UpdateEmailCampaignUseCase {
  constructor(private readonly repo: EmailCampaignRepository) {}

  async execute(input: UpdateEmailCampaignInput): Promise<{ ok: true }> {
    const campaign = await this.repo.findById(input.id, input.orgId)
    if (!campaign) throw new NotFoundError('Campaña no encontrada')
    if (!campaign.isEditable) {
      throw new ValidationError(`No se puede editar una campaña en estado '${campaign.status}'`)
    }

    campaign.update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.preheader !== undefined ? { preheader: input.preheader } : {}),
      ...(input.html !== undefined ? { html: input.html } : {}),
      ...(input.text !== undefined ? { text: input.text } : {}),
      ...(input.segment !== undefined
        ? { segment_json: input.segment ? JSON.stringify(input.segment) : null }
        : {}),
      ...(input.scheduled_at !== undefined ? { scheduled_at: input.scheduled_at } : {}),
    })
    await this.repo.save(campaign)
    return { ok: true }
  }
}
