import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { ActivityRepository } from '../../ports/repositories/activity-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { NotFoundError } from '../../../domain/errors/not-found'
import { Activity } from '../../../domain/entities/activity'
import type { CalendarEvent } from '../../../domain/entities/calendar-event'
import { activityTypeForEvent, eventDurationMinutes } from '../../../domain/rules/calendar-activity-rules'

export class ToggleEventCompleteUseCase {
  /**
   * `activityRepo` e `ids` son opcionales para no romper a los llamadores que
   * sólo quieren tildar el evento (y a los tests que no los inyectan). Cuando
   * están, completar un evento registra la actividad comercial y destildarlo
   * la da de baja.
   */
  constructor(
    private readonly calendarRepo: CalendarRepository,
    private readonly activityRepo?: ActivityRepository,
    private readonly ids?: IdGenerator,
  ) {}

  async execute(eventId: string, orgId: string): Promise<{ completed: number; activity_logged: boolean }> {
    const event = await this.calendarRepo.findById(eventId, orgId)
    if (!event) throw new NotFoundError('Evento no encontrado')

    event.toggleComplete()
    await this.calendarRepo.save(event)

    const activityLogged = await this.syncActivity(event.completed === 1, event, orgId)
    return { completed: event.completed, activity_logged: activityLogged }
  }

  /**
   * Espeja el estado del evento en la actividad derivada. Best-effort: si
   * falla, el evento igual queda tildado — perder la métrica es molesto,
   * perder el tilde que el agente acaba de hacer es peor.
   */
  private async syncActivity(
    completed: boolean,
    event: CalendarEvent,
    orgId: string,
  ): Promise<boolean> {
    const repo = this.activityRepo
    if (!repo || !this.ids) return false

    const activityType = activityTypeForEvent(event.event_type)
    if (!activityType) return false

    try {
      if (!completed) {
        // Destildar borra sólo la actividad que generó este evento; las
        // cargadas a mano tienen calendar_event_id NULL y no se tocan.
        await repo.deleteByCalendarEventId(event.id, orgId)
        return false
      }

      // Idempotente: tildar dos veces no duplica.
      const existing = await repo.findByCalendarEventId(event.id, orgId)
      if (existing) return true

      await repo.save(Activity.create({
        id: this.ids.generate(),
        org_id: orgId,
        // El dueño de la actividad es el agente del evento, no quien lo tilda:
        // si un admin cierra la visita de un agente, la gestión es del agente.
        agent_id: event.agent_id,
        activity_type: activityType,
        description: event.title,
        result: null,
        duration_minutes: eventDurationMinutes(event.start_at, event.end_at, event.all_day),
        lead_id: event.lead_id,
        contact_id: event.contact_id,
        property_id: event.property_id,
        appraisal_id: event.appraisal_id,
        calendar_event_id: event.id,
      }))
      return true
    } catch {
      return false
    }
  }
}
