import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingEventRepository } from '../../ports/repositories/landing-event-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Lead } from '../../../domain/entities/lead'
import { LandingEvent } from '../../../domain/entities/landing-event'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface SubmitLandingFormInput {
  fullSlug: string
  fields: { name: string; phone: string; email?: string | null; address?: string | null; message?: string | null }
  visitorId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null }
}

export interface SubmitLandingFormOutput {
  leadId: string
  successMessage: string
}

const DEFAULT_SUCCESS = '¡Gracias! Nos pondremos en contacto a la brevedad.'

export class SubmitLeadFromLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly events: LandingEventRepository,
    private readonly leads: LeadRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: SubmitLandingFormInput): Promise<SubmitLandingFormOutput> {
    const landing = await this.landings.findByFullSlug(input.fullSlug)
    if (!landing || landing.status !== 'published') throw new NotFoundError('Landing', input.fullSlug)

    if (!input.fields.name?.trim()) throw new ValidationError('Nombre es requerido')
    if (!input.fields.phone?.trim()) throw new ValidationError('Teléfono es requerido')

    const rules = landing.lead_rules ?? {}
    const assignedTo = rules.assigned_agent_id ?? landing.agent_id

    const lead = Lead.create({
      id: this.idGen.generate(),
      org_id: landing.org_id,
      full_name: input.fields.name.trim(),
      phone: input.fields.phone.trim(),
      email: input.fields.email ?? null,
      source: `landing:${landing.full_slug}`,
      source_detail: rules.campaign ?? null,
      property_address: input.fields.address ?? null,
      neighborhood: null,
      property_type: 'departamento',
      operation: landing.kind === 'lead_capture' ? 'tasacion' : 'venta',
      stage: 'nuevo',
      assigned_to: assignedTo,
      notes: input.fields.message ?? null,
      estimated_value: null,
      budget: null,
      timing: null,
      personas_trabajo: null,
      mascotas: null,
      next_step: null,
      next_step_date: null,
      lost_reason: null,
      first_contact_at: null,
      contact_id: null,
    })
    await this.leads.save(lead)

    const ev = LandingEvent.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      slug: landing.full_slug,
      event_type: 'form_submit',
      visitor_id: input.visitorId ?? null,
      session_id: null,
      utm_source: input.utm?.source ?? null,
      utm_medium: input.utm?.medium ?? null,
      utm_campaign: input.utm?.campaign ?? null,
      referrer: input.utm?.referrer ?? null,
      user_agent: null,
    })
    await this.events.save(ev)

    const leadFormBlock = landing.blocks.find(b => b.type === 'lead-form')
    const successMessage = (leadFormBlock?.data as any)?.success_message ?? DEFAULT_SUCCESS

    return { leadId: lead.id, successMessage }
  }
}
