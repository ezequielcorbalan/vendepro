import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { canRequestPublish, type Actor } from '../../../domain/rules/landing-rules'

export class RequestPublishUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)
    if (!canRequestPublish(input.actor, { agent_id: landing.agent_id, status: landing.status })) {
      throw new UnauthorizedError('No podés solicitar publicación (debe estar en draft y ser owner o admin).')
    }
    const next = landing.transitionStatus('pending_review').setReviewNote(null)
    await this.landings.save(next)
  }
}
