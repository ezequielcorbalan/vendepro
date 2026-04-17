import { describe, it, expect } from 'vitest'
import { EventType, EVENT_TYPES } from '../../src/domain/value-objects/event-type'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('EventType value object', () => {
  it('exposes the canonical EVENT_TYPES list', () => {
    expect(EVENT_TYPES).toEqual([
      'llamada',
      'reunion',
      'visita_captacion',
      'visita_comprador',
      'tasacion',
      'seguimiento',
      'admin',
      'firma',
      'otro',
    ])
  })

  it.each(EVENT_TYPES)('creates valid event type "%s"', (value) => {
    const type = EventType.create(value)
    expect(type.value).toBe(value)
  })

  it('throws for invalid event type', () => {
    expect(() => EventType.create('not-a-type')).toThrow(ValidationError)
  })

  it('throws for empty string', () => {
    expect(() => EventType.create('')).toThrow(ValidationError)
  })

  it('error message lists allowed values', () => {
    try {
      EventType.create('bogus')
    } catch (e) {
      expect((e as Error).message).toContain('llamada')
      expect((e as Error).message).toContain('otro')
    }
  })

  it('toString returns the value', () => {
    const type = EventType.create('llamada')
    expect(type.toString()).toBe('llamada')
  })
})
