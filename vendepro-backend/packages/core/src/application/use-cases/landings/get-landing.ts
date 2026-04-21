import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import type { Actor } from '../../../domain/rules/landing-rules'

export class GetLandingUseCase {
  constructor(private readonly landings: LandingRepository) {}
  async execute(input: { actor: Actor; orgId: string; landingId: string }) {
    const l = await this.landings.findById(input.landingId, input.orgId)
    if (!l) throw new NotFoundError('Landing', input.landingId)
    if (input.actor.role !== 'admin' && l.agent_id !== input.actor.userId) throw new UnauthorizedError()
    return l
  }
}
