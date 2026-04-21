import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { canArchive, type Actor } from '../../../domain/rules/landing-rules'

export class UnarchiveLandingUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)
    if (!canArchive(input.actor, { agent_id: landing.agent_id })) throw new UnauthorizedError()
    if (landing.status !== 'archived') return
    await this.landings.save(landing.transitionStatus('draft'))
  }
}
