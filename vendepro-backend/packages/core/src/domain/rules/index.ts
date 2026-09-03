export { getLeadUrgency, getLeadChecklist, getLeadChecklistScore, isOverdue, computeLeadFunnel, computeConversionRate } from './lead-rules'
export type { LeadUrgency, LeadForUrgency, LeadForChecklist } from './lead-rules'
export { canSeeAll, canManageOrg, canManageAgents, canSetObjectives, isAdmin } from './role-rules'
export type { UserRole } from './role-rules'
export { canTransitionPropertyStatus } from './property-rules'
export type { PropertyStatus } from './property-rules'
export { canTransitionReservationStage } from './reservation-rules'
export type { ReservationStage } from './reservation-rules'
export { REPORT_HEALTH_BENCHMARKS, computeHealthStatus, computeDeltaHealthStatus, daysBetweenISO } from './report-health-rules'
export type { HealthStatus } from './report-health-rules'
export {
  isOwner,
  canEditLanding,
  canRequestPublish,
  canPublish,
  canRejectPublishRequest,
  canArchive,
  canRollback,
  canManageTemplates,
  VERSION_RETENTION_NON_PUBLISH,
  AI_EDITS_PER_MINUTE,
  AUTOSAVE_THROTTLE_MS,
} from './landing-rules'
export type { Role, Actor, LandingRef } from './landing-rules'

// Automatizaciones — condiciones e interpolación
export {
  readPath,
  parseConditions,
  evaluateConditions,
  evaluateCondition,
  firstFailingCondition,
} from './automation-conditions'
export type { AutomationCondition, AutomationContext } from './automation-conditions'
export {
  interpolate,
  extractTokens,
  unknownTokens,
  escapeHtml,
  htmlToText,
} from './automation-interpolation'
export type { InterpolateOptions } from './automation-interpolation'

// Template base de los emails — el marco de marca que envuelve todo envío
export {
  renderEmailHtml,
  renderEmailText,
  extractContentFragment,
  VENDEPRO_BRAND,
} from './email-template'
export type { EmailBrand, RenderEmailHtmlInput, RenderEmailTextInput } from './email-template'
export * from './email-deliverability'
