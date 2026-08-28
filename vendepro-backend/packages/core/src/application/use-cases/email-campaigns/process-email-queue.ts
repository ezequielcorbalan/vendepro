import type { EmailCampaignRepository, EmailCampaignSendRepository, CampaignSendRow } from '../../ports/repositories/email-campaign-repository'
import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import type { EmailService, SendEmailInput } from '../../ports/services/email-service'
import type { UnsubscribeTokenSigner } from '../../ports/services/unsubscribe-token-signer'
import type { EmailCampaign } from '../../../domain/entities/email-campaign'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import { buildPersonalizedEmail } from '../email-shared/personalize'
import { VENDEPRO_BRAND } from '../../../domain/rules/email-template'
import type { EmailBrand } from '../../../domain/rules/email-template'

const BATCH_SIZE = 100
const MAX_ATTEMPTS = 3

export interface ProcessEmailQueueResult {
  campaigns_processed: number
  emails_sent: number
  emails_failed: number
}

/**
 * Despachador de la cola de envío. Lo dispara el cron (sweeper) y
 * también `waitUntil` inmediatamente después de encolar, para que
 * las campañas chicas salgan al instante.
 *
 * Por corrida procesa hasta `maxBatchesPerCampaign` lotes de 100
 * (límite del batch API de Resend) por campaña — el resto queda
 * pendiente para la próxima corrida. Un lote que falla marca sus
 * filas con attempts+1; a los 3 intentos se considera fallo definitivo.
 */
export class ProcessEmailQueueUseCase {
  constructor(
    private readonly campaignRepo: EmailCampaignRepository,
    private readonly sendRepo: EmailCampaignSendRepository,
    private readonly settingsRepo: EmailSettingsRepository,
    private readonly emailService: EmailService,
    private readonly unsubscribeSigner: UnsubscribeTokenSigner,
    /** Base de la página pública de baja, ej: https://vendepro.com.ar */
    private readonly publicBaseUrl: string,
    /**
     * Opcional: de acá sale el logo y el color con los que el template base
     * arma el encabezado. Sin repo, el mail sale con la marca de la plataforma.
     */
    private readonly orgRepo?: OrganizationRepository,
  ) {}

  async execute(maxBatchesPerCampaign = 5): Promise<ProcessEmailQueueResult> {
    // Promover campañas programadas cuyo horario ya llegó.
    const scheduled = await this.campaignRepo.listByStatus('scheduled', 20)
    for (const c of scheduled) {
      if (c.scheduled_at && new Date(c.scheduled_at).getTime() <= Date.now()) {
        c.update({ status: 'sending' })
        await this.campaignRepo.save(c)
      }
    }

    const sending = await this.campaignRepo.listByStatus('sending', 20)
    let sent = 0
    let failed = 0

    for (const campaign of sending) {
      const result = await this.processCampaign(campaign, maxBatchesPerCampaign)
      sent += result.sent
      failed += result.failed
    }

    return { campaigns_processed: sending.length, emails_sent: sent, emails_failed: failed }
  }

  private async processCampaign(
    campaign: EmailCampaign,
    maxBatches: number,
  ): Promise<{ sent: number; failed: number }> {
    const settings = await this.settingsRepo.findByOrg(campaign.org_id)
    // Si deshabilitaron el envío a mitad de campaña, no mandamos más
    // (queda 'sending'; al reactivar, el cron retoma donde quedó).
    if (!settings?.isReadyToSend) return { sent: 0, failed: 0 }

    const from = { email: settings.from_email!, name: settings.from_name ?? 'VendéPro' }
    const brand = await this.resolveBrand(campaign.org_id, settings.from_name)
    let sent = 0
    let failed = 0

    for (let i = 0; i < maxBatches; i++) {
      const pending = await this.sendRepo.listPending(campaign.id, BATCH_SIZE, MAX_ATTEMPTS)
      if (pending.length === 0) break

      const emails = await Promise.all(pending.map(row => this.buildEmail(campaign, row, from, settings.reply_to, brand)))
      try {
        if (this.emailService.sendBatch && emails.length > 1) {
          await this.emailService.sendBatch(emails)
        } else {
          for (const email of emails) await this.emailService.send(email)
        }
        await this.sendRepo.markSent(pending.map(r => r.id))
        sent += pending.length
      } catch (err: any) {
        await this.sendRepo.markFailed(pending.map(r => r.id), err?.message ?? 'Error de envío')
        failed += pending.length
      }
    }

    // Actualizar contadores y cerrar la campaña si no queda nada pendiente.
    const remaining = await this.sendRepo.countPending(campaign.id, MAX_ATTEMPTS)
    const rows = await this.sendRepo.listByCampaign(campaign.id, campaign.org_id, 100000)
    const sentCount = rows.filter(r => r.status === 'sent').length
    const failedCount = rows.filter(r => r.status === 'failed' && r.attempts >= MAX_ATTEMPTS).length
    campaign.update({
      sent_count: sentCount,
      failed_count: failedCount,
      ...(remaining === 0 ? { status: 'sent' as const, sent_at: new Date().toISOString() } : {}),
    })
    await this.campaignRepo.save(campaign)

    return { sent, failed }
  }

  private async buildEmail(
    campaign: EmailCampaign,
    row: CampaignSendRow,
    from: { email: string; name: string },
    replyTo: string | null,
    brand: EmailBrand,
  ): Promise<SendEmailInput> {
    return buildPersonalizedEmail({
      orgId: campaign.org_id,
      recipient: { email: row.email, name: row.name },
      fields: {
        subject: campaign.subject ?? '',
        html: campaign.html ?? '',
        text: campaign.text ?? '',
        preheader: campaign.preheader,
      },
      from,
      replyTo,
      publicBaseUrl: this.publicBaseUrl,
      signer: this.unsubscribeSigner,
      brand,
      tags: { kind: 'campaign', campaign_id: campaign.id },
    })
  }

  /**
   * Branding de la org para el template base. El nombre del remitente pesa más
   * que el de la organización: es el que el cliente ya vio en la bandeja.
   * Una falla acá no puede frenar la campaña — se cae a la marca de VendéPro.
   */
  private async resolveBrand(orgId: string, fromName: string | null): Promise<EmailBrand> {
    const fallback: EmailBrand = { ...VENDEPRO_BRAND, name: fromName ?? VENDEPRO_BRAND.name }
    if (!this.orgRepo) return fallback
    try {
      const org = await this.orgRepo.findById(orgId)
      if (!org) return fallback
      return {
        name: fromName ?? org.name,
        logoUrl: org.logo_url,
        color: org.brand_color,
        accentColor: VENDEPRO_BRAND.accentColor,
      }
    } catch {
      return fallback
    }
  }
}
