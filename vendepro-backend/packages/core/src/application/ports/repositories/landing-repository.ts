import type { Landing } from '../../../domain/entities/landing'
import type { LandingStatusValue } from '../../../domain/value-objects/landing-status'

export interface LandingFilters {
  status?: LandingStatusValue | LandingStatusValue[]
  agent_id?: string
  kind?: 'lead_capture' | 'property'
}

export interface LandingRepository {
  findById(id: string, orgId: string): Promise<Landing | null>
  findByFullSlug(fullSlug: string): Promise<Landing | null>
  findByOrg(orgId: string, filters?: LandingFilters): Promise<Landing[]>
  save(landing: Landing): Promise<void>
  existsFullSlug(fullSlug: string): Promise<boolean>
}
