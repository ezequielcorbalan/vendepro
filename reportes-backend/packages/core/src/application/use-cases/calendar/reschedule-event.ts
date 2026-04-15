import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface RescheduleEventInput {
  eventId: string
  orgId: string
  startAt: string
  endAt: string
}

export class RescheduleEventUseCase {
  constructor(private readonly calendarRepo: CalendarRepository) {}

  async execute(input: RescheduleEventInput): Promise<void> {
    const event = await this.calendarRepo.findById(input.eventId, input.orgId)
    if (!event) throw new NotFoundError('Evento no encontrado')

    event.reschedule(input.startAt, input.endAt)
    await this.calendarRepo.save(event)
  }
}
