import type { LeadStageValue } from '../value-objects/lead-stage'
import { PROPERTY_STAGES, type PropertyStageValue } from '../value-objects/property-stage'

export const NON_FINAL_PROPERTY_STAGES: PropertyStageValue[] = PROPERTY_STAGES.filter(
  s => !(['vendida', 'perdida', 'invalida', 'archivada'] as PropertyStageValue[]).includes(s)
)

export interface SyncRule<From extends string, To extends string> {
  when: From
  thenIfTargetIn: To[]
  setTargetTo: To
}

export const LEAD_TO_PROPERTY_SYNC: SyncRule<LeadStageValue, PropertyStageValue>[] = [
  { when: 'captado',  thenIfTargetIn: ['propuesta'],             setTargetTo: 'captada'  },
  { when: 'invalido', thenIfTargetIn: NON_FINAL_PROPERTY_STAGES, setTargetTo: 'invalida' },
]

export const PROPERTY_TO_LEAD_SYNC: SyncRule<PropertyStageValue, LeadStageValue>[] = [
  { when: 'vendida', thenIfTargetIn: ['captado'], setTargetTo: 'finalizado' },
  { when: 'perdida', thenIfTargetIn: ['captado'], setTargetTo: 'perdido'    },
]
