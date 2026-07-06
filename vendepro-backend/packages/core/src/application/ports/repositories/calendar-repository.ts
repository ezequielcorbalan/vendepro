import type { CalendarEvent } from '../../../domain/entities/calendar-event'

export interface CalendarFilters {
  agent_id?: string
  start?: string
  end?: string
  event_type?: string
}

export interface CalendarRepository {
  findById(id: string, orgId: string): Promise<CalendarEvent | null>
  findByOrg(orgId: string, filters?: CalendarFilters): Promise<CalendarEvent[]>
  save(event: CalendarEvent): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  /**
   * Vincula el evento local con su espejo en Google Calendar. Best-effort:
   * si las columnas de la migración 035 no existen todavía, no debe tirar.
   */
  setGoogleMeta(id: string, orgId: string, googleEventId: string | null, inviteSentAt: string | null): Promise<void>
  /** Returns events for a specific date (YYYY-MM-DD), excluding cancelled ones, ordered by start_at */
  findByOrgAndDate(orgId: string, date: string): Promise<CalendarEvent[]>
}
