import type { EmailCampaignRepository } from '../../ports/repositories/email-campaign-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { EmailCampaign } from '../../../domain/entities/email-campaign'
import type { CampaignSegment } from '../../../domain/entities/email-campaign'

export interface CreateEmailCampaignInput {
  orgId: string
  userId: string
  name: string
  subject?: string | null
  preheader?: string | null
  html?: string | null
  text?: string | null
  segment?: CampaignSegment | null
  scheduled_at?: string | null
}

export class CreateEmailCampaignUseCase {
  constructor(
    private readonly repo: EmailCampaignRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: CreateEmailCampaignInput): Promise<{ id: string }> {
    const campaign = EmailCampaign.create({
      id: this.idGenerator.generate(),
      org_id: input.orgId,
      name: input.name,
      subject: input.subject ?? null,
      preheader: input.preheader ?? null,
      html: input.html ?? null,
      text: input.text ?? null,
      segment_json: input.segment ? JSON.stringify(input.segment) : null,
      scheduled_at: input.scheduled_at ?? null,
      created_by: input.userId,
    })
    await this.repo.save(campaign)
    return { id: campaign.id }
  }
}
