import type { AgentProfileRepository } from '../../ports/repositories/agent-profile-repository'
import { AgentProfile } from '../../../domain/entities/agent-profile'
import { slugifyName } from '../../../domain/value-objects/agent-slug'

export class GetAgentProfileUseCase {
  constructor(private readonly repo: AgentProfileRepository) {}

  /** Devuelve el perfil o uno vacío (no persistido) para que la UI tenga qué mostrar. */
  async execute(input: { orgId: string; userId: string; fullName: string }): Promise<AgentProfile> {
    const found = await this.repo.findByUserId(input.userId)
    if (found) return found
    return AgentProfile.create({ user_id: input.userId, org_id: input.orgId, slug: slugifyName(input.fullName) })
  }
}
