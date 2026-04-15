import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { CalendarEvent } from '../../../domain/entities/calendar-event'
import type { EventTypeValue } from '../../../domain/value-objects/event-type'

export interface CreateCalendarEventInput {
  org_id: string
  agent_id: string
  title: string
  event_type: EventTypeValue
  start_at: string | null
  end_at: string | null
  all_day?: number
  description?: string | null
  lead_id?: string | null
  contact_id?: string | null
  property_id?: string | null
  appraisal_id?: string | null
  reservation_id?: string | null
  color?: string | null
}

export class CreateCalendarEventUseCase {
  constructor(
    private readonly calendarRepo: CalendarRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateCalendarEventInput): Promise<{ id: string }> {
    const event = CalendarEvent.create({
      id: this.idGen.generate(),
      org_id: input.org_id,
      agent_id: input.agent_id,
      title: input.title,
      event_type: input.event_type,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day ?? 0,
      description: input.description ?? null,
      lead_id: input.lead_id ?? null,
      contact_id: input.contact_id ?? null,
      property_id: input.property_id ?? null,
      appraisal_id: input.appraisal_id ?? null,
      reservation_id: input.reservation_id ?? null,
      color: input.color ?? null,
      completed: 0,
    })
    await this.calendarRepo.save(event)
    return { id: event.id }
  }
}
