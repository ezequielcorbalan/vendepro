import type { Activity } from '../../../domain/entities/activity'

export interface ActivityFilters {
  agent_id?: string
  lead_id?: string
  contact_id?: string
  property_id?: string
}

export interface ActivityRepository {
  findByOrg(orgId: string, filters?: ActivityFilters): Promise<Activity[]>
  save(activity: Activity): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
