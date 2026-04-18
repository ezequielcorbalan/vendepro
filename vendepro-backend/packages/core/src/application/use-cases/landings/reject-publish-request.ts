import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canRejectPublishRequest, type Actor } from '../../../domain/rules/landing-rules'

export class RejectPublishRequestUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; note?: string }): Promise<void> {
    if (!canRejectPublishRequest(input.actor)) throw new UnauthorizedError('Solo admin puede rechazar.')
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)
    if (landing.status !== 'pending_review') {
      throw new ValidationError(`Solo se puede rechazar una landing en pending_review (actual: ${landing.status}).`)
    }
    const next = landing.transitionStatus('draft').setReviewNote(input.note ?? null)
    await this.landings.save(next)
  }
}
