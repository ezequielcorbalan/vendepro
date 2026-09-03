import type { AgentProfile } from '../../../domain/entities/agent-profile'

export interface AgentProfileRepository {
  findByUserId(userId: string): Promise<AgentProfile | null>
  findByOrgAndSlug(orgId: string, slug: string): Promise<AgentProfile | null>
  /** true si el slug ya está tomado en la org por OTRO usuario. */
  existsSlug(orgId: string, slug: string, exceptUserId?: string): Promise<boolean>
  save(profile: AgentProfile): Promise<void>
}
