import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { StageHistoryRepository } from '../../ports/repositories/stage-history-repository'
import type { PropertyStageValue } from '../../../domain/value-objects/property-stage'
import { PropertyStage } from '../../../domain/value-objects/property-stage'
import type { LeadStageValue } from '../../../domain/value-objects/lead-stage'
import { SyncEngine } from '../../../domain/rules/sync-engine'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdatePropertyStageInput {
  propertyId: string
  orgId: string
  newStage: PropertyStageValue
  changedBy: string
  notes?: string | null
  /** Cambio manual libre: saltea la máquina de transiciones (pipeline comercial). */
  override?: boolean
}

export interface UpdatePropertyStageOutput {
  syncedLeadId: string | null
}

export class UpdatePropertyStageUseCase {
  constructor(
    private readonly propRepo: PropertyRepository,
    private readonly stageHistoryRepo?: StageHistoryRepository,
    private readonly leadRepo?: LeadRepository,
  ) {}

  async execute(input: UpdatePropertyStageInput): Promise<UpdatePropertyStageOutput> {
    const property = await this.propRepo.findById(input.propertyId, input.orgId)
    if (!property) throw new NotFoundError('Propiedad no encontrada')

    const currentStage = (property.commercial_stage ?? 'propuesta') as PropertyStageValue
    // override = pipeline comercial libre: solo validamos que la etapa exista.
    if (input.override) PropertyStage.create(input.newStage)
    else PropertyStage.create(currentStage).transitionTo(input.newStage)

    await this.propRepo.updateStage(input.propertyId, input.orgId, input.newStage)

    if (this.stageHistoryRepo) {
      await this.stageHistoryRepo.log({
        org_id: input.orgId,
        entity_type: 'property',
        entity_id: input.propertyId,
        from_stage: currentStage,
        to_stage: input.newStage,
        changed_by: input.changedBy,
        notes: input.notes ?? null,
        triggered_by: 'user',
      })
    }

    let syncedLeadId: string | null = null
    if (this.leadRepo && property.lead_id) {
      const leadId = property.lead_id
      const lead = await this.leadRepo.findById(leadId, input.orgId)
      const currentLeadStage = (lead?.stage ?? null) as LeadStageValue | null
      const newLeadStage = SyncEngine.applyPropertyToLead(input.newStage, currentLeadStage)
      if (lead && newLeadStage && newLeadStage !== currentLeadStage) {
        lead.syncStage(newLeadStage)
        await this.leadRepo.save(lead)
        if (this.stageHistoryRepo) {
          await this.stageHistoryRepo.log({
            org_id: input.orgId,
            entity_type: 'lead',
            entity_id: leadId,
            from_stage: currentLeadStage,
            to_stage: newLeadStage,
            changed_by: input.changedBy,
            notes: `Sync desde property ${input.propertyId} (${input.newStage})`,
            triggered_by: 'sync',
          })
        }
        syncedLeadId = leadId
      }
    }

    return { syncedLeadId }
  }
}
