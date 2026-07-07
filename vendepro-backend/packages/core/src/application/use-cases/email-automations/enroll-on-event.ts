import type { EmailAutomationRepository, EmailAutomationEnrollmentRepository } from '../../ports/repositories/email-automation-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { firstRunAt } from './first-run-at'

export interface EnrollOnEventInput {
  orgId: string
  /** 'lead_created' | 'stage:<stage>' | 'appraisal_created' */
  event: string
  recipient: {
    email: string
    name?: string | null
    contact_id?: string | null
    lead_id?: string | null
  }
}

/**
 * Inscribe un destinatario en TODAS las automatizaciones activas de su org
 * cuyo trigger coincide con el evento. Idempotente por (automation, email):
 * repetir el evento no reinscribe. Pensado para fire-and-forget desde los
 * hooks del CRM (creación de lead, cambio de stage).
 */
export class EnrollOnEventUseCase {
  constructor(
    private readonly automationRepo: EmailAutomationRepository,
    private readonly enrollmentRepo: EmailAutomationEnrollmentRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: EnrollOnEventInput): Promise<{ enrolled_in: number }> {
    const email = (input.recipient.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) return { enrolled_in: 0 }

    const automations = (await this.automationRepo.listActiveByTrigger(input.event))
      .filter(a => a.org_id === input.orgId && a.steps.length > 0)
    if (automations.length === 0) return { enrolled_in: 0 }

    for (const automation of automations) {
      await this.enrollmentRepo.insertMany([{
        id: this.idGenerator.generate(),
        org_id: input.orgId,
        automation_id: automation.id,
        email,
        name: input.recipient.name ?? null,
        contact_id: input.recipient.contact_id ?? null,
        lead_id: input.recipient.lead_id ?? null,
        next_run_at: firstRunAt(automation.steps),
      }])
    }
    return { enrolled_in: automations.length }
  }
}
