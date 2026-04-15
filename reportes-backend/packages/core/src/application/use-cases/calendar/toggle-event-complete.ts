import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export class ToggleEventCompleteUseCase {
  constructor(private readonly calendarRepo: CalendarRepository) {}

  async execute(eventId: string, orgId: string): Promise<{ completed: number }> {
    const event = await this.calendarRepo.findById(eventId, orgId)
    if (!event) throw new NotFoundError('Evento no encontrado')

    event.toggleComplete()
    await this.calendarRepo.save(event)
    return { completed: event.completed }
  }
}
