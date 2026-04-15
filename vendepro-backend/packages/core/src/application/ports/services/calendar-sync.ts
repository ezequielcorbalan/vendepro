export interface ExternalCalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
}

export interface CalendarSyncService {
  isConnected(agentId: string, orgId: string): Promise<boolean>
  syncEvent(event: ExternalCalendarEvent, agentId: string, orgId: string): Promise<void>
  deleteEvent(externalId: string, agentId: string, orgId: string): Promise<void>
}
