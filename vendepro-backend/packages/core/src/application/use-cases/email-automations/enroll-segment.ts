import type { EmailAutomationRepository, EmailAutomationEnrollmentRepository } from '../../ports/repositories/email-automation-repository'
import type { EmailAudienceRepository } from '../../ports/repositories/email-audience-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { CampaignSegment } from '../../../domain/entities/email-campaign'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import { firstRunAt } from './first-run-at'

export interface EnrollSegmentInput {
  automationId: string
  orgId: string
  segment: CampaignSegment
}

/**
 * Inscribe manualmente un segmento (contacts/leads) en una automatización.
 * Los ya inscriptos se ignoran (no se reinicia su secuencia).
 */
export class EnrollSegmentUseCase {
  constructor(
    private readonly automationRepo: EmailAutomationRepository,
    private readonly enrollmentRepo: EmailAutomationEnrollmentRepository,
    private readonly audienceRepo: EmailAudienceRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: EnrollSegmentInput): Promise<{ ok: true; enrolled: number }> {
    const automation = await this.automationRepo.findById(input.automationId, input.orgId)
    if (!automation) throw new NotFoundError('Automatización no encontrada')
    if (automation.steps.length === 0) {
      throw new ValidationError('La automatización no tiene pasos todavía')
    }
    if (input.segment?.source !== 'contacts' && input.segment?.source !== 'leads') {
      throw new ValidationError('Segmento inválido')
    }

    const recipients = await this.audienceRepo.resolve(input.orgId, input.segment)
    if (recipients.length === 0) {
      throw new ValidationError('El segmento quedó vacío (sin emails válidos o dados de baja)')
    }

    const nextRun = firstRunAt(automation.steps)
    await this.enrollmentRepo.insertMany(recipients.map(r => ({
      id: this.idGenerator.generate(),
      org_id: input.orgId,
      automation_id: automation.id,
      email: r.email,
      name: r.name,
      contact_id: r.contact_id,
      lead_id: r.lead_id,
      next_run_at: nextRun,
    })))

    return { ok: true, enrolled: recipients.length }
  }
}
