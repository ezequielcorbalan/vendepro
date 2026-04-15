import { ValidationError } from '../errors/validation-error'
import { EventType, EVENT_TYPES } from '../value-objects/event-type'
import type { EventTypeValue } from '../value-objects/event-type'

export interface CalendarEventProps {
  id: string
  org_id: string
  agent_id: string
  title: string
  event_type: EventTypeValue
  start_at: string | null
  end_at: string | null
  all_day: number
  description: string | null
  lead_id: string | null
  contact_id: string | null
  property_id: string | null
  appraisal_id: string | null
  reservation_id: string | null
  color: string | null
  completed: number
  created_at: string
  updated_at: string
  // Joined
  agent_name?: string
  lead_name?: string
  contact_name?: string
  property_address?: string
  phone?: string | null
}

export class CalendarEvent {
  private constructor(private props: CalendarEventProps) {}

  static create(props: Omit<CalendarEventProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): CalendarEvent {
    if (!props.title?.trim()) throw new ValidationError('Título es requerido')
    if (!EVENT_TYPES.includes(props.event_type)) {
      throw new ValidationError(`Tipo de evento inválido: "${props.event_type}"`)
    }
    const now = new Date().toISOString()
    return new CalendarEvent({
      ...props,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get title() { return this.props.title }
  get event_type() { return this.props.event_type }
  get start_at() { return this.props.start_at }
  get end_at() { return this.props.end_at }
  get all_day() { return this.props.all_day }
  get description() { return this.props.description }
  get lead_id() { return this.props.lead_id }
  get contact_id() { return this.props.contact_id }
  get property_id() { return this.props.property_id }
  get appraisal_id() { return this.props.appraisal_id }
  get reservation_id() { return this.props.reservation_id }
  get color() { return this.props.color }
  get completed() { return this.props.completed }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }
  get agent_name() { return this.props.agent_name }
  get lead_name() { return this.props.lead_name }
  get contact_name() { return this.props.contact_name }
  get property_address() { return this.props.property_address }
  get phone() { return this.props.phone }

  isOverdue(now: Date = new Date()): boolean {
    if (this.props.completed) return false
    if (!this.props.end_at) return false
    return new Date(this.props.end_at) < now
  }

  toggleComplete(): void {
    this.props.completed = this.props.completed ? 0 : 1
    this.props.updated_at = new Date().toISOString()
  }

  reschedule(startAt: string, endAt: string): void {
    this.props.start_at = startAt
    this.props.end_at = endAt
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): CalendarEventProps {
    return { ...this.props }
  }
}
