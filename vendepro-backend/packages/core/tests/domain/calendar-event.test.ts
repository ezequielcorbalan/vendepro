import { describe, it, expect } from 'vitest'
import { CalendarEvent } from '../../src/domain/entities/calendar-event'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'evt-1',
  org_id: 'org_mg',
  agent_id: 'agent-1',
  title: 'Llamada de seguimiento',
  event_type: 'llamada' as const,
  start_at: '2026-04-15T10:00:00.000Z',
  end_at: '2026-04-15T10:30:00.000Z',
  all_day: 0,
  description: null,
  lead_id: 'lead-1',
  contact_id: null,
  property_id: null,
  appraisal_id: null,
  reservation_id: null,
  color: null,
  completed: 0,
}

describe('CalendarEvent entity', () => {
  it('creates a valid event', () => {
    const evt = CalendarEvent.create(baseProps)
    expect(evt.title).toBe('Llamada de seguimiento')
    expect(evt.event_type).toBe('llamada')
    expect(evt.completed).toBe(0)
  })

  it('throws if title is empty', () => {
    expect(() => CalendarEvent.create({ ...baseProps, title: '' })).toThrow(ValidationError)
  })

  it('throws for invalid event_type', () => {
    expect(() => CalendarEvent.create({ ...baseProps, event_type: 'fiesta' as any })).toThrow(ValidationError)
  })

  it('detects overdue event', () => {
    const past = '2026-01-01T00:00:00.000Z'
    const evt = CalendarEvent.create({ ...baseProps, end_at: past })
    expect(evt.isOverdue()).toBe(true)
  })

  it('completed event is not overdue', () => {
    const past = '2026-01-01T00:00:00.000Z'
    const evt = CalendarEvent.create({ ...baseProps, end_at: past, completed: 1 })
    expect(evt.isOverdue()).toBe(false)
  })

  it('future event is not overdue', () => {
    const future = '2099-01-01T00:00:00.000Z'
    const evt = CalendarEvent.create({ ...baseProps, end_at: future })
    expect(evt.isOverdue()).toBe(false)
  })

  it('toggles complete on and off', () => {
    const evt = CalendarEvent.create(baseProps)
    evt.toggleComplete()
    expect(evt.completed).toBe(1)
    evt.toggleComplete()
    expect(evt.completed).toBe(0)
  })

  it('reschedules event', () => {
    const evt = CalendarEvent.create(baseProps)
    evt.reschedule('2026-05-01T09:00:00.000Z', '2026-05-01T09:30:00.000Z')
    expect(evt.start_at).toBe('2026-05-01T09:00:00.000Z')
    expect(evt.end_at).toBe('2026-05-01T09:30:00.000Z')
  })
})
