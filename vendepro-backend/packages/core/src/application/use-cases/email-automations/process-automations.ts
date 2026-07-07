import type {
  EmailAutomationRepository, EmailAutomationEnrollmentRepository,
  EmailAutomationSendRepository, EnrollmentRow,
} from '../../ports/repositories/email-automation-repository'
import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import type { EmailSuppressionRepository } from '../../ports/repositories/email-suppression-repository'
import type { EmailService } from '../../ports/services/email-service'
import type { UnsubscribeTokenSigner } from '../../ports/services/unsubscribe-token-signer'
import type { IdGenerator } from '../../ports/id-generator'
import type { EmailAutomation } from '../../../domain/entities/email-automation'
import { buildPersonalizedEmail } from '../email-shared/personalize'

export interface ProcessAutomationsResult {
  processed: number
  sent: number
  failed: number
}

/**
 * Despachador de automatizaciones (cron): toma inscripciones activas cuyo
 * próximo paso ya venció, envía el email del paso y agenda el siguiente.
 * Bajo volumen por tick (drip), así que envía de a uno.
 */
export class ProcessAutomationsUseCase {
  constructor(
    private readonly automationRepo: EmailAutomationRepository,
    private readonly enrollmentRepo: EmailAutomationEnrollmentRepository,
    private readonly sendRepo: EmailAutomationSendRepository,
    private readonly settingsRepo: EmailSettingsRepository,
    private readonly suppressionRepo: EmailSuppressionRepository,
    private readonly emailService: EmailService,
    private readonly signer: UnsubscribeTokenSigner,
    private readonly idGenerator: IdGenerator,
    private readonly publicBaseUrl: string,
  ) {}

  async execute(batchSize = 200): Promise<ProcessAutomationsResult> {
    const now = new Date()
    const due = await this.enrollmentRepo.listDue(now.toISOString(), batchSize)

    // Cache de automatizaciones y settings por org para no repetir queries.
    const automationCache = new Map<string, EmailAutomation | null>()
    const settingsReadyCache = new Map<string, boolean>()

    let sent = 0
    let failed = 0

    for (const enrollment of due) {
      const automation = await this.loadAutomation(automationCache, enrollment)
      // Automatización borrada o pausada → congelar (se retoma al reactivar).
      if (!automation || !automation.isActive) continue

      const step = automation.steps[enrollment.current_step]
      if (!step) {
        await this.enrollmentRepo.finish(enrollment.id, 'completed')
        continue
      }

      // Respeta bajas producidas a mitad de secuencia.
      const suppressed = await this.suppressionRepo.findByEmail(enrollment.org_id, enrollment.email)
      if (suppressed) {
        await this.enrollmentRepo.finish(enrollment.id, 'unsubscribed')
        continue
      }

      const ready = await this.isSenderReady(settingsReadyCache, enrollment.org_id)
      if (!ready) continue // sin remitente habilitado: congelar hasta que se configure

      const settings = (await this.settingsRepo.findByOrg(enrollment.org_id))!
      const email = await buildPersonalizedEmail({
        orgId: enrollment.org_id,
        recipient: { email: enrollment.email, name: enrollment.name },
        fields: { subject: step.subject, html: step.html, text: step.text },
        from: { email: settings.from_email!, name: settings.from_name ?? 'VendéPro' },
        replyTo: settings.reply_to,
        publicBaseUrl: this.publicBaseUrl,
        signer: this.signer,
        tags: { kind: 'automation', automation_id: automation.id, step: String(enrollment.current_step) },
      })

      let sendStatus: 'sent' | 'failed' = 'sent'
      let sendError: string | null = null
      try {
        await this.emailService.send(email)
        sent++
      } catch (err: any) {
        sendStatus = 'failed'
        sendError = (err?.message ?? 'Error de envío').slice(0, 500)
        failed++
      }

      await this.sendRepo.record({
        id: this.idGenerator.generate(),
        org_id: enrollment.org_id,
        automation_id: automation.id,
        enrollment_id: enrollment.id,
        step_order: enrollment.current_step,
        email: enrollment.email,
        status: sendStatus,
        error: sendError,
      })

      // Avanza (aun si falló: es drip, un paso caído no bloquea la secuencia).
      await this.advanceOrFinish(automation, enrollment)
    }

    return { processed: due.length, sent, failed }
  }

  private async loadAutomation(
    cache: Map<string, EmailAutomation | null>,
    enrollment: EnrollmentRow,
  ): Promise<EmailAutomation | null> {
    if (cache.has(enrollment.automation_id)) return cache.get(enrollment.automation_id)!
    const automation = await this.automationRepo.findById(enrollment.automation_id, enrollment.org_id)
    cache.set(enrollment.automation_id, automation)
    return automation
  }

  private async isSenderReady(cache: Map<string, boolean>, orgId: string): Promise<boolean> {
    if (cache.has(orgId)) return cache.get(orgId)!
    const settings = await this.settingsRepo.findByOrg(orgId)
    const ready = !!settings?.isReadyToSend
    cache.set(orgId, ready)
    return ready
  }

  private async advanceOrFinish(automation: EmailAutomation, enrollment: EnrollmentRow): Promise<void> {
    const nextStep = enrollment.current_step + 1
    const next = automation.steps[nextStep]
    if (!next) {
      await this.enrollmentRepo.finish(enrollment.id, 'completed')
      return
    }
    const nextRunAt = new Date(Date.now() + next.delay_hours * 3600_000).toISOString()
    await this.enrollmentRepo.advance(enrollment.id, nextStep, nextRunAt)
  }
}
