import type { CalendarRepository, CalendarFilters } from '../../ports/repositories/calendar-repository'
import type { CalendarEvent } from '../../../domain/entities/calendar-event'

export class GetCalendarEventsUseCase {
  constructor(private readonly calendarRepo: CalendarRepository) {}

  async execute(orgId: string, filters?: CalendarFilters): Promise<CalendarEvent[]> {
    return this.calendarRepo.findByOrg(orgId, filters)
  }
}
