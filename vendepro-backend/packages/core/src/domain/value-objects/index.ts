export { LeadStage, LEAD_STAGES, BUYER_LEAD_STAGES, LEAD_PIPELINES, PIPELINE_STAGES } from './lead-stage'
export type { LeadStageValue, BuyerLeadStageValue, AnyLeadStageValue, LeadPipeline } from './lead-stage'
export { PropertyStage, PROPERTY_STAGES } from './property-stage'
export type { PropertyStageValue } from './property-stage'
export { EventType, EVENT_TYPES } from './event-type'
export type { EventTypeValue } from './event-type'
export { Money } from './money'
export type { Currency } from './money'
export { Email } from './email'
export { ANALYTICS_PERIODS, parseAnalyticsPeriod, periodStartDate } from './analytics-period'
export type { AnalyticsPeriod } from './analytics-period'
export { LandingStatus, LANDING_STATUSES } from './landing-status'
export type { LandingStatusValue } from './landing-status'
export { LandingSlug, generateSlugSuffix, SLUG_SUFFIX_ALPHABET } from './landing-slug'
export type { LandingSlugProps } from './landing-slug'
export * from './block-schemas'
export { BINDING_MODES, assertBindingMode } from './appraisal-binding-mode'
export type { BindingMode } from './appraisal-binding-mode'
export {
  APPRAISAL_BLOCK_TYPES,
  STRUCTURAL_BLOCK_TYPES,
  DYNAMIC_BLOCK_TYPES,
  WEB_ONLY_BLOCK_TYPES,
  FREE_BLOCK_TYPES,
  PDF_LOCKED_TYPES,
  WEB_ONLY_TYPES_SET,
  assertAppraisalBlockType,
} from './appraisal-block-type'
export type { AppraisalBlockType } from './appraisal-block-type'
export { validateAppraisalBlocks } from './appraisal-block-schemas'
export type { AppraisalTemplateBlock, ValidateResult } from './appraisal-block-schemas'

// Automatizaciones — catálogo de triggers, acciones y variables
export {
  AUTOMATION_TRIGGERS,
  TIME_BASED_TRIGGERS,
  TRIGGER_DEFINITIONS,
  AUTOMATION_ACTIONS,
  PHASE_1_ACTIONS,
  ACTION_DEFINITIONS,
  CONDITION_OPERATORS,
  OPERATOR_LABELS,
  UNARY_OPERATORS,
  VARIABLE_DEFINITIONS,
  getTriggerDefinition,
  getActionDefinition,
  isTimeBasedTrigger,
  actionChainsEvents,
  isConditionOperator,
  variablesForTrigger,
} from './automation-catalog'
export type {
  AutomationTrigger,
  AutomationActionType,
  ConditionOperator,
  EntityType,
  TriggerDefinition,
  ActionDefinition,
  ConfigField,
  VariableDefinition,
} from './automation-catalog'
