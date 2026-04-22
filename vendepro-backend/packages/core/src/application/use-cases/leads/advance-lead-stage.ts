import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { StageHistoryRepository } from '../../ports/repositories/stage-history-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { NotFoundError } from '../../../domain/errors/not-found'
import { CalendarEvent } from '../../../domain/entities/calendar-event'
import type { LeadStageValue } from '../../../domain/value-objects/lead-stage'
import type { SendMetaConversionEventUseCase } from '../marketing/send-meta-conversion-event'

export interface AdvanceLeadStageInput {
  leadId: string
  orgId: string
  newStage: LeadStageValue
  changedBy: string
  notes?: string | null
}

export interface AdvanceLeadStageOutput {
  autoFollowup: object | null
}

/**
 * `metaSender` es opcional para no romper consumidores existentes. Si se
 * inyecta, se gatilla el evento de Meta CAPI tras persistir el cambio de
 * etapa, dentro de un try/catch para nunca bloquear la respuesta.
 */
export class AdvanceLeadStageUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly calendarRepo: CalendarRepository,
    private readonly stageHistoryRepo: StageHistoryRepository,
    private readonly idGen: IdGenerator,
    private readonly metaSender?: SendMetaConversionEventUseCase,
  ) {}

  async execute(input: AdvanceLeadStageInput): Promise<AdvanceLeadStageOutput> {
    const lead = await this.leadRepo.findById(input.leadId, input.orgId)
    if (!lead) throw new NotFoundError('Lead no encontrado')

    const fromStage = lead.stage
    const { firstContactAt } = lead.advanceStage(input.newStage)

    await this.leadRepo.save(lead)

    await this.stageHistoryRepo.log({
      org_id: input.orgId,
      entity_type: 'lead',
      entity_id: lead.id,
      from_stage: fromStage,
      to_stage: input.newStage,
      changed_by: input.changedBy,
      notes: input.notes ?? null,
    })

    // Auto-action: create followup event when advancing to "presentada"
    let autoFollowup: object | null = null
    if (input.newStage === 'presentada') {
      const followupDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const event = CalendarEvent.create({
        id: this.idGen.generate(),
        org_id: input.orgId,
        agent_id: lead.assigned_to,
        title: `Seguimiento: ${lead.full_name}`,
        event_type: 'seguimiento',
        start_at: followupDate,
        end_at: followupDate,
        all_day: 0,
        description: 'Seguimiento automático post-presentación',
        lead_id: lead.id,
        contact_id: null,
        property_id: null,
        appraisal_id: null,
        reservation_id: null,
        color: null,
        completed: 0,
      })
      await this.calendarRepo.save(event)
      autoFollowup = event.toObject()
    }

    // Hook Meta Conversion API — fire-and-forget, no debe bloquear ni romper.
    if (this.metaSender) {
      try {
        await this.metaSender.execute({
          orgId: input.orgId,
          leadId: lead.id,
          stageKey: input.newStage,
        })
      } catch (err) {
        // No-op: errores de Meta CAPI ya quedan en meta_event_log; no propagar.
        // eslint-disable-next-line no-console
        console.error('[meta-capi] sender failed (swallowed):', (err as Error)?.message ?? err)
      }
    }

    return { autoFollowup }
  }
}
