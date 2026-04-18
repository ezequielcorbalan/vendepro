import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingEventRepository, AnalyticsSummary } from '../../ports/repositories/landing-event-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import type { Actor } from '../../../domain/rules/landing-rules'

export class GetLandingAnalyticsUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly events: LandingEventRepository,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; rangeDays: 7 | 14 | 30 }): Promise<AnalyticsSummary> {
    const l = await this.landings.findById(input.landingId, input.orgId)
    if (!l) throw new NotFoundError('Landing', input.landingId)
    if (input.actor.role !== 'admin' && l.agent_id !== input.actor.userId) throw new UnauthorizedError()

    const until = new Date()
    const since = new Date(until.getTime() - input.rangeDays * 24 * 60 * 60 * 1000)
    return this.events.summary(l.id, { since: since.toISOString(), until: until.toISOString() })
  }
}
