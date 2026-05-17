import type { LeadStageValue } from '../value-objects/lead-stage'
import type { PropertyStageValue } from '../value-objects/property-stage'
import { LEAD_TO_PROPERTY_SYNC, PROPERTY_TO_LEAD_SYNC } from './sync-policies'

export class SyncEngine {
  static applyLeadToProperty(
    leadStage: LeadStageValue,
    propertyStage: PropertyStageValue | null,
  ): PropertyStageValue | null {
    if (propertyStage === null) return null
    const rule = LEAD_TO_PROPERTY_SYNC.find(r => r.when === leadStage)
    if (!rule) return null
    if (!rule.thenIfTargetIn.includes(propertyStage)) return null
    return rule.setTargetTo
  }

  static applyPropertyToLead(
    propertyStage: PropertyStageValue,
    leadStage: LeadStageValue | null,
  ): LeadStageValue | null {
    if (leadStage === null) return null
    const rule = PROPERTY_TO_LEAD_SYNC.find(r => r.when === propertyStage)
    if (!rule) return null
    if (!rule.thenIfTargetIn.includes(leadStage)) return null
    return rule.setTargetTo
  }
}
