import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { StageHistoryRepository } from '../../ports/repositories/stage-history-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { AnyLeadStageValue } from '../../../domain/value-objects/lead-stage'
import type { PropertyStageValue } from '../../../domain/value-objects/property-stage'
import { SyncEngine } from '../../../domain/rules/sync-engine'
import type { SendMetaConversionEventUseCase } from '../marketing/send-meta-conversion-event'

export interface AdvanceLeadStageInput {
  leadId: string
  orgId: string
  newStage: AnyLeadStageValue
  changedBy: string
  notes?: string | null
  /** Corrección manual: saltea la máquina de transiciones (bypass total). */
  override?: boolean
}

export interface AdvanceLeadStageOutput {
  syncedPropertyId: string | null
  syncedPropertyStage: PropertyStageValue | null
  fromStage: string
}

/**
 * El seguimiento automático a +7 días al pasar a "presentada" ya no vive acá:
 * es la automatización `seguimiento_presentada`, que la migración 046 activa
 * en cada org con la misma guarda de pipeline vendedor que tenía este código.
 * Se mudó para que el cliente pueda verla, cambiarle el plazo o apagarla.
 */
export class AdvanceLeadStageUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    // Sin uso desde que el seguimiento pasó a ser una automatización. Se
    // mantiene para no cambiar la firma en 19 call sites; sacarlo es una
    // limpieza aparte.
    private readonly calendarRepo: CalendarRepository,
    private readonly stageHistoryRepo: StageHistoryRepository,
    private readonly idGen: IdGenerator,
    private readonly propertyRepo?: PropertyRepository,
    private readonly metaSender?: SendMetaConversionEventUseCase,
  ) {}

  async execute(input: AdvanceLeadStageInput): Promise<AdvanceLeadStageOutput> {
    const lead = await this.leadRepo.findById(input.leadId, input.orgId)
    if (!lead) throw new NotFoundError('Lead no encontrado')

    // Los side effects comerciales (invariante de captado, sync lead→property,
    // auto-followup de presentada) son del pipeline vendedor; el comprador solo
    // mueve su máquina de estados y loggea stage_history.
    const isVendor = lead.pipeline !== 'comprador'

    // Invariante de negocio (incluso con override): un lead no puede pasar a
    // "captado" sin una propiedad vinculada. Captado = la propiedad fue captada.
    if (isVendor && input.newStage === 'captado' && this.propertyRepo) {
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
    if (isVendor && this.propertyRepo) {
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

    return { syncedPropertyId, syncedPropertyStage, fromStage }
  }
}
