import type { EmailCampaignRepository, EmailCampaignSendRepository } from '../../ports/repositories/email-campaign-repository'
import type { EmailAudienceRepository } from '../../ports/repositories/email-audience-repository'
import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { ValidationError } from '../../../domain/errors/validation-error'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface QueueCampaignSendInput {
  campaignId: string
  orgId: string
  /** ISO datetime para programar; ausente = enviar ahora. */
  scheduledAt?: string | null
}

export interface QueueCampaignSendResult {
  ok: true
  total_recipients: number
  status: 'sending' | 'scheduled'
}

/**
 * Congela la audiencia (resuelve el segmento → email_campaign_sends)
 * y deja la campaña lista para que el despachador la procese.
 */
export class QueueCampaignSendUseCase {
  constructor(
    private readonly campaignRepo: EmailCampaignRepository,
    private readonly sendRepo: EmailCampaignSendRepository,
    private readonly audienceRepo: EmailAudienceRepository,
    private readonly settingsRepo: EmailSettingsRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: QueueCampaignSendInput): Promise<QueueCampaignSendResult> {
    const campaign = await this.campaignRepo.findById(input.campaignId, input.orgId)
    if (!campaign) throw new NotFoundError('Campaña no encontrada')
    campaign.assertReadyToSend()

    const settings = await this.settingsRepo.findByOrg(input.orgId)
    if (!settings?.isReadyToSend) {
      throw new ValidationError('Configurá y habilitá el remitente en Configuración → Marketing → Email antes de enviar')
    }

    const segment = campaign.segment!
    const recipients = await this.audienceRepo.resolve(input.orgId, segment)
    if (recipients.length === 0) {
      throw new ValidationError('La audiencia quedó vacía (sin emails válidos o todos dados de baja)')
    }

    await this.sendRepo.insertMany(recipients.map(r => ({
      id: this.idGenerator.generate(),
      org_id: input.orgId,
      campaign_id: campaign.id,
      email: r.email,
      name: r.name,
      contact_id: r.contact_id,
      lead_id: r.lead_id,
    })))

    const scheduledAt = input.scheduledAt ?? null
    const isFuture = !!scheduledAt && new Date(scheduledAt).getTime() > Date.now()
    campaign.update({
      status: isFuture ? 'scheduled' : 'sending',
      scheduled_at: scheduledAt,
      total_recipients: recipients.length,
    })
    await this.campaignRepo.save(campaign)

    return { ok: true, total_recipients: recipients.length, status: isFuture ? 'scheduled' : 'sending' }
  }
}
