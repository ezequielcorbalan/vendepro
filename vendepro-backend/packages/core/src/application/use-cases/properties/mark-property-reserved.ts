import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { StageHistoryRepository, StageHistoryTrigger } from '../../ports/repositories/stage-history-repository'
import type { PropertyStageValue } from '../../../domain/value-objects/property-stage'
import { UpdatePropertyStageUseCase } from './update-property-stage'

/**
 * Etapas desde las que una reserva mueve la propiedad a "Reservada". Una
 * reserva firmada es la prueba: aunque no se haya marcado "publicada", la
 * propiedad está reservada. Nunca toca una que ya está reservada o cerrada
 * (vendida, perdida, inválida, archivada).
 */
export const RESERVABLE_STAGES: PropertyStageValue[] = [
  'propuesta', 'captada', 'documentacion', 'publicada', 'suspendida', 'vencida',
]

export interface MarkPropertyReservedInput {
  orgId: string
  propertyId: string
  /** user_id de quien lo hizo. Vacío en lo automático: queda el agente de la propiedad. */
  changedBy?: string | null
  triggeredBy: StageHistoryTrigger
  /** Por qué: queda en el historial ("Leída una reserva en Drive: Reserva.pdf"). */
  reason: string
}

/**
 * Pasa la propiedad a "Reservada" cuando aparece una reserva: un documento de
 * reserva leído en Drive o subido al portal, o la reserva cargada a mano en la
 * ficha. Mismo camino que el cambio de etapa manual (historial y sync del
 * lead), así no hay dos formas de reservar.
 */
export class MarkPropertyReservedUseCase {
  constructor(
    private readonly properties: PropertyRepository,
    private readonly stageHistory?: StageHistoryRepository,
    private readonly leads?: LeadRepository,
  ) {}

  async execute(input: MarkPropertyReservedInput): Promise<{ moved: boolean; from: string | null }> {
    const property = await this.properties.findById(input.propertyId, input.orgId)
    if (!property) return { moved: false, from: null }
    const current = (property.commercial_stage ?? 'propuesta') as PropertyStageValue
    if (!RESERVABLE_STAGES.includes(current)) return { moved: false, from: current }
    // stage_history.changed_by apunta a users: sin una persona a quien
    // atribuirlo no se mueve (no pasa en la práctica: toda propiedad tiene agente).
    const changedBy = input.changedBy || property.agent_id
    if (!changedBy) return { moved: false, from: current }

    await new UpdatePropertyStageUseCase(this.properties, this.stageHistory, this.leads).execute({
      propertyId: input.propertyId,
      orgId: input.orgId,
      newStage: 'reservada',
      changedBy,
      notes: input.reason,
      // No todas las etapas tienen la transición directa (captada → reservada):
      // la reserva firmada manda sobre el orden del pipeline.
      override: true,
      triggeredBy: input.triggeredBy,
    })
    return { moved: true, from: current }
  }
}
