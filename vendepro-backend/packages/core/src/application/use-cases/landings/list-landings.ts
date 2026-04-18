import type { LandingRepository, LandingFilters } from '../../ports/repositories/landing-repository'
import type { Actor } from '../../../domain/rules/landing-rules'

export class ListLandingsUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; scope?: 'mine' | 'org' | 'pending_review'; filters?: LandingFilters }) {
    const { actor, orgId, scope = 'mine', filters = {} } = input
    if (scope === 'org') {
      if (actor.role !== 'admin') throw new Error('Solo admin puede listar todas las landings del org')
      return this.landings.findByOrg(orgId, filters)
    }
    if (scope === 'pending_review') {
      if (actor.role !== 'admin') throw new Error('Solo admin ve pendientes de revisión')
      return this.landings.findByOrg(orgId, { ...filters, status: 'pending_review' })
    }
    return this.landings.findByOrg(orgId, { ...filters, agent_id: actor.userId })
  }
}
