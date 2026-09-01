export * from './ports/index'

// Auth
export * from './use-cases/auth/login'
export * from './use-cases/auth/change-password'
export * from './use-cases/auth/create-user'
export * from './use-cases/auth/register-with-org'
export * from './use-cases/auth/request-password-reset'
export * from './use-cases/auth/complete-password-reset'

// Leads
export * from './use-cases/leads/get-leads'
export * from './use-cases/leads/create-lead'
export * from './use-cases/leads/create-lead-with-contact'
export * from './use-cases/leads/update-lead'
export * from './use-cases/leads/advance-lead-stage'
export * from './use-cases/leads/delete-lead'

// Lead properties (propiedades de interés de un lead comprador)
export * from './use-cases/lead-properties/index'

// Contacts
export * from './use-cases/contacts/get-contacts'
export * from './use-cases/contacts/create-contact'
export * from './use-cases/contacts/update-contact'
export * from './use-cases/contacts/delete-contact'
export * from './use-cases/contacts/get-contact-detail'
export * from './use-cases/contacts/create-tag'

// Mensajes predeterminados de WhatsApp
export * from './use-cases/whatsapp-templates/index'

// Properties
export * from './use-cases/properties/get-properties'
export * from './use-cases/properties/create-property'
export * from './use-cases/properties/update-property-price'
export * from './use-cases/properties/update-property-status'
export * from './use-cases/properties/get-property-catalogs'
export * from './use-cases/properties/get-property-detail'
export * from './use-cases/properties/update-property'
export * from './use-cases/properties/update-property-stage'
export * from './use-cases/properties/mark-external-report'
export * from './use-cases/properties/delete-property'
export * from './use-cases/properties/upload-property-photo'
export * from './use-cases/properties/reorder-property-photos'
export * from './use-cases/properties/delete-property-photo'

// Appraisals
export * from './use-cases/appraisals/get-appraisals'
export * from './use-cases/appraisals/get-appraisal-detail'
export * from './use-cases/appraisals/create-appraisal'
export * from './use-cases/appraisals/update-appraisal'
export * from './use-cases/appraisals/delete-appraisal'
export * from './use-cases/appraisals/add-appraisal-comparable'
export * from './use-cases/appraisals/update-appraisal-comparable'
export * from './use-cases/appraisals/remove-appraisal-comparable'
export { GenerateAppraisalPdfUseCase } from './use-cases/appraisals/generate-appraisal-pdf'
export type {
  GenerateAppraisalPdfDeps,
  GenerateAppraisalPdfInput,
  GenerateAppraisalPdfResult,
} from './use-cases/appraisals/generate-appraisal-pdf'

// Prefactibilidades
export * from './use-cases/prefactibilidades/get-prefactibilidades'
export * from './use-cases/prefactibilidades/get-prefactibilidad-detail'
export * from './use-cases/prefactibilidades/create-prefactibilidad'

// Fichas de Tasación
export * from './use-cases/fichas/create-ficha'
export * from './use-cases/fichas/get-ficha'
export * from './use-cases/fichas/list-fichas'
export * from './use-cases/fichas/update-ficha'
export * from './use-cases/fichas/delete-ficha'

// Ficha de Tasación pública — links que completa el propietario (041_)
export * from './use-cases/ficha-links/generate-ficha-link'
export * from './use-cases/ficha-links/manage-ficha-links'

// Reports
export * from './use-cases/reports/get-reports'
export * from './use-cases/reports/get-report-detail'
export * from './use-cases/reports/create-report'
export * from './use-cases/reports/update-report'
export * from './use-cases/reports/delete-report'

// Calendar
export * from './use-cases/calendar/get-calendar-events'
export * from './use-cases/calendar/create-calendar-event'
export * from './use-cases/calendar/toggle-event-complete'
export * from './use-cases/calendar/reschedule-event'

// Transactions
export * from './use-cases/transactions/get-reservations'
export * from './use-cases/transactions/create-reservation'
export * from './use-cases/transactions/advance-reservation-stage'

// Admin
export * from './use-cases/admin/create-agent'
export * from './use-cases/admin/get-agents'
export * from './use-cases/admin/get-deleted-agents'
export * from './use-cases/admin/update-agent'
export * from './use-cases/admin/delete-agent'
export * from './use-cases/admin/restore-agent'
export * from './use-cases/admin/set-objectives'
export * from './use-cases/admin/update-agent-role'
export * from './use-cases/admin/get-roles'
export * from './use-cases/admin/get-org-settings'
export * from './use-cases/admin/update-org-settings'
export * from './use-cases/admin/get-user-profile'
export * from './use-cases/admin/update-user-profile'
export * from './use-cases/admin/get-user-notifications'
export * from './use-cases/admin/generate-org-api-key'
export * from './use-cases/admin/get-org-api-key'

// Dashboard
export * from './use-cases/dashboard/get-dashboard-stats'
export * from './use-cases/dashboard/get-appraisal-stats'
export * from './use-cases/dashboard/get-activity-stats'
export * from './use-cases/dashboard/get-today-events'
export * from './use-cases/dashboard/get-pending-followups'
export * from './use-cases/dashboard/get-agent-stats'

// Analytics
export * from './use-cases/analytics/get-listings-performance'
export * from './use-cases/analytics/list-reports-with-metrics'
export * from './use-cases/analytics/get-neighborhood-comparison'
export * from './use-cases/analytics/get-active-listings-with-benchmark'
export * from './use-cases/analytics/search-entities'
export * from './use-cases/analytics/export-leads'

// AI
export * from './use-cases/ai/extract-property-metrics'
export * from './use-cases/ai/extract-comparable-from-screenshot'
export * from './use-cases/ai/extract-lead-from-text'
export * from './use-cases/ai/extract-lead-from-image'

// Landings
export * from './use-cases/landings/index'

// Property Visit Forms (Ficha de Visita)
export * from './use-cases/visit-forms/index'

// Marketing (Meta Conversion API)
export * from './use-cases/marketing/index'

// Campañas de email (Resend)
export * from './use-cases/email-campaigns/index'

// Automatizaciones de email (secuencias drip)

// Integraciones con CRMs externos (KiteProp)
export * from './use-cases/integrations/index'

// Sold Properties (cierres reales para tasaciones)
export * from './use-cases/sold-properties/index'

// Public
export * from './use-cases/public/get-public-report'
export * from './use-cases/public/get-public-appraisal'
export * from './use-cases/public/get-public-visit-form'
export * from './use-cases/public/submit-visit-form-response'
export * from './use-cases/public/get-public-prefactibilidad'
export * from './use-cases/public/create-public-lead'
export * from './use-cases/public/get-public-ficha-link'
export * from './use-cases/public/submit-public-ficha'

// Appraisal Templates
export { ListAppraisalTemplatesUseCase } from './use-cases/appraisal-templates/list-appraisal-templates'
export type { ListAppraisalTemplatesInput } from './use-cases/appraisal-templates/list-appraisal-templates'
export { GetAppraisalTemplateUseCase } from './use-cases/appraisal-templates/get-appraisal-template'
export { CreateAppraisalTemplateUseCase } from './use-cases/appraisal-templates/create-appraisal-template'
export type { CreateAppraisalTemplateInput } from './use-cases/appraisal-templates/create-appraisal-template'
export { UpdateAppraisalTemplateUseCase } from './use-cases/appraisal-templates/update-appraisal-template'
export type { UpdateAppraisalTemplateInput } from './use-cases/appraisal-templates/update-appraisal-template'
export { DuplicateAppraisalTemplateUseCase } from './use-cases/appraisal-templates/duplicate-appraisal-template'
export { ArchiveAppraisalTemplateUseCase } from './use-cases/appraisal-templates/archive-appraisal-template'

// Org Variables
export { ListOrgVariablesUseCase } from './use-cases/org-variables/list-org-variables'
export { CreateOrgVariableUseCase } from './use-cases/org-variables/create-org-variable'
export type { CreateOrgVariableInput } from './use-cases/org-variables/create-org-variable'
export { UpdateOrgVariableUseCase } from './use-cases/org-variables/update-org-variable'
export { DeleteOrgVariableUseCase } from './use-cases/org-variables/delete-org-variable'

// API Tokens (integración externa)
export * from './use-cases/api-tokens/create-api-token'
export * from './use-cases/api-tokens/list-api-tokens'
export * from './use-cases/api-tokens/revoke-api-token'
export * from './use-cases/api-tokens/delete-api-token'
export * from './use-cases/api-tokens/import-leads'

// Webhooks salientes
export * from './use-cases/webhooks/create-webhook'
export * from './use-cases/webhooks/list-webhooks'
export * from './use-cases/webhooks/update-webhook'
export * from './use-cases/webhooks/delete-webhook'
export * from './use-cases/webhooks/test-webhook'
export * from './use-cases/webhooks/list-webhook-deliveries'
export * from './use-cases/webhooks/dispatch-webhook-event'
export * from './use-cases/webhooks/lead-webhook-payload'

// Appraisal Rendering
export { HydrateTemplateBlocksUseCase } from './use-cases/appraisal-rendering/hydrate-template-blocks'
export type { HydratedBlock, HydrateInput } from './use-cases/appraisal-rendering/hydrate-template-blocks'
export { SyncTemplateSnapshotUseCase } from './use-cases/appraisal-rendering/sync-template-snapshot'
export { SetBlockOverridesUseCase } from './use-cases/appraisal-rendering/set-block-overrides'

// Portales (feed XML ZonaProp / Argenprop)
export * from './use-cases/portals/zonaprop-feed-mapper'
export * from './use-cases/portals/get-portal-feed'

// Automatizaciones
export * from './use-cases/automations/run-automations-for-event'
export * from './use-cases/automations/drain-automation-jobs'
export * from './use-cases/automations/build-automation-context'
export * from './use-cases/automations/manage-automations'
export * from './use-cases/automations/generate-email-sequence'
