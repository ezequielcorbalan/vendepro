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

// Contacts
export * from './use-cases/contacts/get-contacts'
export * from './use-cases/contacts/create-contact'
export * from './use-cases/contacts/delete-contact'
export * from './use-cases/contacts/get-contact-detail'
export * from './use-cases/contacts/create-tag'

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
export * from './use-cases/appraisals/remove-appraisal-comparable'

// Prefactibilidades
export * from './use-cases/prefactibilidades/get-prefactibilidades'
export * from './use-cases/prefactibilidades/get-prefactibilidad-detail'
export * from './use-cases/prefactibilidades/create-prefactibilidad'

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

// Public
export * from './use-cases/public/get-public-report'
export * from './use-cases/public/get-public-appraisal'
export * from './use-cases/public/get-public-visit-form'
export * from './use-cases/public/submit-visit-form-response'
export * from './use-cases/public/get-public-prefactibilidad'
export * from './use-cases/public/create-public-lead'
