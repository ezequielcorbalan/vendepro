import { ValidationError } from '../errors/validation-error'

export const LANDING_EVENT_TYPES = ['pageview', 'cta_click', 'form_start', 'form_submit'] as const
export type LandingEventType = typeof LANDING_EVENT_TYPES[number]

export interface LandingEventProps {
  id: string
  landing_id: string
  slug: string
  event_type: LandingEventType
  visitor_id: string | null
  session_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  user_agent: string | null
  created_at: string
}

export class LandingEvent {
  private constructor(private readonly props: LandingEventProps) {}

  static create(input: Omit<LandingEventProps, 'created_at'> & { created_at?: string }): LandingEvent {
    if (!LANDING_EVENT_TYPES.includes(input.event_type)) {
      throw new ValidationError(`event_type inválido: "${input.event_type}"`)
    }
    return new LandingEvent({ ...input, created_at: input.created_at ?? new Date().toISOString() })
  }

  static fromPersistence(props: LandingEventProps): LandingEvent { return new LandingEvent(props) }

  get id() { return this.props.id }
  get landing_id() { return this.props.landing_id }
  get slug() { return this.props.slug }
  get event_type() { return this.props.event_type }
  get visitor_id() { return this.props.visitor_id }
  get session_id() { return this.props.session_id }
  get utm_source() { return this.props.utm_source }
  get utm_medium() { return this.props.utm_medium }
  get utm_campaign() { return this.props.utm_campaign }
  get referrer() { return this.props.referrer }
  get user_agent() { return this.props.user_agent }
  get created_at() { return this.props.created_at }

  toObject(): LandingEventProps { return { ...this.props } }
}
