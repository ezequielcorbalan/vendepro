import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { StageHistoryRepository } from '../../ports/repositories/stage-history-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import { CalendarEvent } from '../../../domain/entities/calendar-event'
import type { LeadStageValue } from '../../../domain/value-objects/lead-stage'
import type { PropertyStageValue } from '../../../domain/value-objects/property-stage'
import { SyncEngine } from '../../../domain/rules/sync-engine'
import type { SendMetaConversionEventUseCase } from '../marketing/send-meta-conversion-event'

export interface AdvanceLeadStageInput {
  leadId: string
  orgId: string
  newStage: LeadStageValue
  changedBy: string
  notes?: string | null
  /** Corrección manual: saltea la máquina de transiciones (bypass total). */
  override?: boolean
}

export interface AdvanceLeadStageOutput {
  autoFollowup: object | null
  syncedPropertyId: string | null
  syncedPropertyStage: PropertyStageValue | null
}

export class AdvanceLeadStageUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly calendarRepo: CalendarRepository,
    private readonly stageHistoryRepo: StageHistoryRepository,
    private readonly idGen: IdGenerator,
    private readonly propertyRepo?: PropertyRepository,
    private readonly metaSender?: SendMetaConversionEventUseCase,
  ) {}

  async execute(input: AdvanceLeadStageInput): Promise<AdvanceLeadStageOutput> {
    const lead = await this.leadRepo.findById(input.leadId, input.orgId)
    if (!lead) throw new NotFoundError('Lead no encontrado')

    // Invariante de negocio (incluso con override): un lead no puede pasar a
    // "captado" sin una propiedad vinculada. Captado = la propiedad fue captada.
    if (input.newStage === 'captado' && this.propertyRepo) {
      const linked = await this.propertyRepo.findByLeadId(input.leadId, input.orgId)
      if (!linked) {
        throw new ValidationError('No se puede pasar a "captado" sin una propiedad vinculada')
      }
    }

    const fromStage = lead.stage
    if (input.override) lead.overrideStage(input.newStage)
    else lead.advanceStage(input.newStage)

    await this.leadRepo.save(lead)

    await this.stageHistoryRepo.log({
      org_id: input.orgId,
      entity_type: 'lead',
      entity_id: lead.id,
      from_stage: fromStage,
      to_stage: input.newStage,
      changed_by: input.changedBy,
      notes: input.notes ?? (input.override ? 'Corrección manual de etapa' : null),
      triggered_by: 'user',
    })

    let syncedPropertyId: string | null = null
    let syncedPropertyStage: PropertyStageValue | null = null
    let propertyId: string | null = null
    if (this.propertyRepo) {
      const property = await this.propertyRepo.findByLeadId(lead.id, input.orgId)
      if (property) {
        propertyId = property.id
        const currentPropStage = (property.commercial_stage ?? null) as PropertyStageValue | null
        const newPropStage = SyncEngine.applyLeadToProperty(input.newStage, currentPropStage)
        if (newPropStage && newPropStage !== currentPropStage) {
          await this.propertyRepo.updateStage(propertyId, input.orgId, newPropStage)
          await this.stageHistoryRepo.log({
            org_id: input.orgId,
            entity_type: 'property',
            entity_id: propertyId,
            from_stage: currentPropStage,
            to_stage: newPropStage,
            changed_by: input.changedBy,
            notes: `Sync desde lead ${lead.id} (${input.newStage})`,
            triggered_by: 'sync',
          })
          syncedPropertyId = propertyId
          syncedPropertyStage = newPropStage
        }
      }
    }

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

    if (this.metaSender) {
      try {
        await this.metaSender.execute({
          orgId: input.orgId,
          leadId: lead.id,
          stageKey: input.newStage,
        })
      } catch (err) {
        console.error('[meta-capi] sender failed (swallowed):', (err as Error)?.message ?? err)
      }
    }

    return { autoFollowup, syncedPropertyId, syncedPropertyStage }
  }
}
