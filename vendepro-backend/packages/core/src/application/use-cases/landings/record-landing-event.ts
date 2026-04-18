import { LandingEvent, type LandingEventType } from '../../../domain/entities/landing-event'
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingEventRepository } from '../../ports/repositories/landing-event-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface RecordEventInput {
  fullSlug: string
  eventType: LandingEventType
  visitorId?: string | null
  sessionId?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  referrer?: string | null
  userAgent?: string | null
}

export class RecordLandingEventUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly events: LandingEventRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: RecordEventInput): Promise<void> {
    const landing = await this.landings.findByFullSlug(input.fullSlug)
    if (!landing || landing.status !== 'published') {
      throw new NotFoundError('Landing', input.fullSlug)
    }
    const ev = LandingEvent.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      slug: landing.full_slug,
      event_type: input.eventType,
      visitor_id: input.visitorId ?? null,
      session_id: input.sessionId ?? null,
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
      referrer: input.referrer ?? null,
      user_agent: input.userAgent ?? null,
    })
    await this.events.save(ev)
  }
}
