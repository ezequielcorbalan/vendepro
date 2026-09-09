import { describe, it, expect, vi } from 'vitest'
import { ToggleEventCompleteUseCase } from '../../../src/application/use-cases/calendar/toggle-event-complete'
import { CalendarEvent } from '../../../src/domain/entities/calendar-event'
import type { EventTypeValue } from '../../../src/domain/value-objects/event-type'

/**
 * La actividad comercial se deriva del calendario: tildar un evento la
 * registra, destildarlo la da de baja. Estos tests fijan ese contrato, que es
 * lo que llena las métricas de performance sin carga manual.
 */

function makeCalendarRepo(event: CalendarEvent) {
  return {
    findById: vi.fn().mockResolvedValue(event),
    findByOrg: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findByOrgAndDate: vi.fn(),
  }
}

function makeActivityRepo() {
  return {
    findByOrg: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findByOrgSince: vi.fn(),
    findLatestByOrg: vi.fn(),
    aggregateByTypeSince: vi.fn(),
    findByCalendarEventId: vi.fn().mockResolvedValue(null),
    deleteByCalendarEventId: vi.fn(),
    countByAgentSince: vi.fn(),
  }
}

const ids = { generate: () => 'act-generated' }

function makeEvent(overrides: Partial<{
  event_type: EventTypeValue
  completed: number
  start_at: string | null
  end_at: string | null
  all_day: number
  lead_id: string | null
}> = {}): CalendarEvent {
  return CalendarEvent.create({
    id: 'evt1',
    org_id: 'org1',
    agent_id: 'agent-owner',
    title: 'Visita con Gustavo Monzón',
    event_type: overrides.event_type ?? 'visita_captacion',
    start_at: overrides.start_at ?? '2026-09-03T14:00:00.000Z',
    end_at: overrides.end_at ?? '2026-09-03T15:30:00.000Z',
    all_day: overrides.all_day ?? 0,
    description: null,
    lead_id: overrides.lead_id ?? 'lead1',
    contact_id: 'contact1',
    property_id: null,
    appraisal_id: null,
    reservation_id: null,
    color: null,
    completed: overrides.completed ?? 0,
  })
}

describe('ToggleEventCompleteUseCase — actividad derivada', () => {
  it('registra la actividad al completar el evento', async () => {
    const event = makeEvent()
    const calendarRepo = makeCalendarRepo(event)
    const activityRepo = makeActivityRepo()

    const result = await new ToggleEventCompleteUseCase(calendarRepo, activityRepo, ids)
      .execute('evt1', 'org1')

    expect(result).toEqual({ completed: 1, activity_logged: true })
    expect(activityRepo.save).toHaveBeenCalledTimes(1)

    const saved = activityRepo.save.mock.calls[0][0].toObject()
    expect(saved.activity_type).toBe('visita_captacion')
    expect(saved.calendar_event_id).toBe('evt1')
    expect(saved.lead_id).toBe('lead1')
    expect(saved.description).toBe('Visita con Gustavo Monzón')
    expect(saved.duration_minutes).toBe(90)
  })

  it('le atribuye la actividad al agente del evento, no a quien lo tilda', async () => {
    const calendarRepo = makeCalendarRepo(makeEvent())
    const activityRepo = makeActivityRepo()

    await new ToggleEventCompleteUseCase(calendarRepo, activityRepo, ids).execute('evt1', 'org1')

    expect(activityRepo.save.mock.calls[0][0].toObject().agent_id).toBe('agent-owner')
  })

  it('no duplica si el evento ya tenía su actividad registrada', async () => {
    const calendarRepo = makeCalendarRepo(makeEvent())
    const activityRepo = makeActivityRepo()
    activityRepo.findByCalendarEventId.mockResolvedValue({ id: 'act-existente' })

    const result = await new ToggleEventCompleteUseCase(calendarRepo, activityRepo, ids)
      .execute('evt1', 'org1')

    expect(result.activity_logged).toBe(true)
    expect(activityRepo.save).not.toHaveBeenCalled()
  })

  it('da de baja la actividad al destildar el evento', async () => {
    const calendarRepo = makeCalendarRepo(makeEvent({ completed: 1 }))
    const activityRepo = makeActivityRepo()

    const result = await new ToggleEventCompleteUseCase(calendarRepo, activityRepo, ids)
      .execute('evt1', 'org1')

    expect(result).toEqual({ completed: 0, activity_logged: false })
    expect(activityRepo.deleteByCalendarEventId).toHaveBeenCalledWith('evt1', 'org1')
    expect(activityRepo.save).not.toHaveBeenCalled()
  })

  it('no registra actividad para eventos que no son gestión comercial', async () => {
    for (const eventType of ['admin', 'otro'] as EventTypeValue[]) {
      const calendarRepo = makeCalendarRepo(makeEvent({ event_type: eventType }))
      const activityRepo = makeActivityRepo()

      const result = await new ToggleEventCompleteUseCase(calendarRepo, activityRepo, ids)
        .execute('evt1', 'org1')

      expect(result.activity_logged).toBe(false)
      expect(activityRepo.save).not.toHaveBeenCalled()
    }
  })

  it('deja la duración en null cuando el evento es de día completo', async () => {
    const calendarRepo = makeCalendarRepo(makeEvent({ all_day: 1 }))
    const activityRepo = makeActivityRepo()

    await new ToggleEventCompleteUseCase(calendarRepo, activityRepo, ids).execute('evt1', 'org1')

    expect(activityRepo.save.mock.calls[0][0].toObject().duration_minutes).toBeNull()
  })

  it('tilda el evento igual si falla el registro de la actividad', async () => {
    const calendarRepo = makeCalendarRepo(makeEvent())
    const activityRepo = makeActivityRepo()
    activityRepo.save.mockRejectedValue(new Error('columna faltante'))

    const result = await new ToggleEventCompleteUseCase(calendarRepo, activityRepo, ids)
      .execute('evt1', 'org1')

    expect(result).toEqual({ completed: 1, activity_logged: false })
    expect(calendarRepo.save).toHaveBeenCalled()
  })

  it('sigue funcionando sin repositorio de actividades', async () => {
    const calendarRepo = makeCalendarRepo(makeEvent())

    const result = await new ToggleEventCompleteUseCase(calendarRepo).execute('evt1', 'org1')

    expect(result).toEqual({ completed: 1, activity_logged: false })
    expect(calendarRepo.save).toHaveBeenCalled()
  })
})
