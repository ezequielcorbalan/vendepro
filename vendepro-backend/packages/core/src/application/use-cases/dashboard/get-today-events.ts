import type { CalendarRepository } from '../../ports/repositories/calendar-repository'

export class GetTodayEventsUseCase {
  constructor(private readonly repo: CalendarRepository) {}

  async execute(orgId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const today = new Date().toISOString().split('T')[0] as string
      const events = await this.repo.findByOrgAndDate(orgId, today)
      return events.map(e => e.toObject() as unknown as Record<string, unknown>)
    } catch {
      return []
    }
  }
}
