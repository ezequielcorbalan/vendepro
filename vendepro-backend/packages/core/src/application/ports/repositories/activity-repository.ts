import type { Activity } from '../../../domain/entities/activity'

export interface ActivityFilters {
  agent_id?: string
  lead_id?: string
  contact_id?: string
  property_id?: string
  /** Solo actividades con created_at >= este valor (ISO date/datetime) */
  since?: string
}

export interface ActivityRepository {
  findByOrg(orgId: string, filters?: ActivityFilters): Promise<Activity[]>
  findById(id: string, orgId: string): Promise<Activity | null>
  save(activity: Activity): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  /** Returns activities since `since` (ISO string), optionally filtered by agentId, with a limit */
  findByOrgSince(orgId: string, since: string, agentId?: string, limit?: number): Promise<Activity[]>
  /** Returns the N most recent activities with agent_name joined from users */
  findLatestByOrg(orgId: string, limit: number): Promise<Array<Activity & { agent_name: string | null }>>
  /** Returns grouped activity counts by type since a date, for a specific agent */
  aggregateByTypeSince(orgId: string, agentId: string, since: string): Promise<Array<{ activity_type: string; count: number }>>
  /** Actividad derivada de un evento de calendario, si ya se registró. */
  findByCalendarEventId(calendarEventId: string, orgId: string): Promise<Activity | null>
  /** Da de baja la actividad derivada de un evento (al destildarlo). */
  deleteByCalendarEventId(calendarEventId: string, orgId: string): Promise<void>
  /** Cuenta actividades por agente desde una fecha — alimenta los KPIs del equipo. */
  countByAgentSince(orgId: string, since: string): Promise<Record<string, number>>
}
