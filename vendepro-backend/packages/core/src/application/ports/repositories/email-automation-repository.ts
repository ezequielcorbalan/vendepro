import type { EmailAutomation } from '../../../domain/entities/email-automation'

export interface EmailAutomationRepository {
  findById(id: string, orgId: string): Promise<EmailAutomation | null>
  listByOrg(orgId: string, limit?: number): Promise<EmailAutomation[]>
  /** Activas con un trigger dado (cross-org) — para el enroll por evento. */
  listActiveByTrigger(triggerEvent: string): Promise<EmailAutomation[]>
  save(automation: EmailAutomation): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}

export interface EnrollmentRow {
  id: string
  org_id: string
  automation_id: string
  email: string
  name: string | null
  contact_id: string | null
  lead_id: string | null
  current_step: number
  status: 'active' | 'completed' | 'cancelled' | 'unsubscribed'
  next_run_at: string | null
  enrolled_at: string
  created_at: string
}

export interface EmailAutomationEnrollmentRepository {
  /** Inscribe destinatarios (ignora los ya inscriptos en la automatización). */
  insertMany(rows: Array<Pick<EnrollmentRow, 'id' | 'org_id' | 'automation_id' | 'email' | 'name' | 'contact_id' | 'lead_id' | 'next_run_at'>>): Promise<void>
  /** Inscriptos activos cuyo próximo paso ya venció (cross-org, para el cron). */
  listDue(now: string, limit: number): Promise<EnrollmentRow[]>
  /** Avanza al próximo paso: setea current_step y next_run_at. */
  advance(id: string, nextStep: number, nextRunAt: string): Promise<void>
  /** Cierra la inscripción con un estado terminal. */
  finish(id: string, status: 'completed' | 'cancelled' | 'unsubscribed'): Promise<void>
  listByAutomation(automationId: string, orgId: string, limit?: number): Promise<EnrollmentRow[]>
  countByStatus(automationId: string, orgId: string): Promise<Record<string, number>>
  deleteByAutomation(automationId: string, orgId: string): Promise<void>
}

export interface AutomationSendRow {
  id: string
  org_id: string
  automation_id: string
  enrollment_id: string
  step_order: number
  email: string
  status: 'sent' | 'failed'
  error: string | null
  sent_at: string
}

export interface EmailAutomationSendRepository {
  record(row: Omit<AutomationSendRow, 'sent_at'>): Promise<void>
  countByAutomation(automationId: string, orgId: string): Promise<{ sent: number; failed: number }>
  deleteByAutomation(automationId: string, orgId: string): Promise<void>
}
