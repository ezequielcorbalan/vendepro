import { describe, it, expect } from 'vitest'
import { PropertyStage, PROPERTY_STAGES } from '../../src/domain/value-objects/property-stage'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('PropertyStage value object', () => {
  it('exposes the canonical PROPERTY_STAGES list', () => {
    expect(PROPERTY_STAGES).toEqual(['captacion', 'publicada', 'con_ofertas', 'reservada', 'vendida', 'suspendida', 'perdida'])
  })

  it.each(PROPERTY_STAGES)('creates valid stage "%s"', (value) => {
    const stage = PropertyStage.create(value)
    expect(stage.value).toBe(value)
  })

  it('throws for invalid stage', () => {
    expect(() => PropertyStage.create('invalid')).toThrow(ValidationError)
  })

  it('allows captacion -> publicada', () => {
    expect(PropertyStage.create('captacion').canTransitionTo('publicada')).toBe(true)
  })

  it('allows captacion -> suspendida', () => {
    expect(PropertyStage.create('captacion').canTransitionTo('suspendida')).toBe(true)
  })

  it('allows publicada -> con_ofertas', () => {
    expect(PropertyStage.create('publicada').canTransitionTo('con_ofertas')).toBe(true)
  })

  it('allows publicada -> reservada', () => {
    expect(PropertyStage.create('publicada').canTransitionTo('reservada')).toBe(true)
  })

  it('allows con_ofertas -> reservada', () => {
    expect(PropertyStage.create('con_ofertas').canTransitionTo('reservada')).toBe(true)
  })

  it('allows reservada -> vendida', () => {
    expect(PropertyStage.create('reservada').canTransitionTo('vendida')).toBe(true)
  })

  it('allows reservada -> publicada (revert if reservation falls through)', () => {
    expect(PropertyStage.create('reservada').canTransitionTo('publicada')).toBe(true)
  })

  it('allows suspendida -> captacion (reactivate)', () => {
    expect(PropertyStage.create('suspendida').canTransitionTo('captacion')).toBe(true)
  })

  it('vendida is terminal', () => {
    const s = PropertyStage.create('vendida')
    expect(s.canTransitionTo('publicada')).toBe(false)
    expect(s.canTransitionTo('suspendida')).toBe(false)
  })

  it('perdida is terminal', () => {
    const s = PropertyStage.create('perdida')
    expect(s.canTransitionTo('publicada')).toBe(false)
    expect(s.canTransitionTo('captacion')).toBe(false)
  })

  it('transitionTo returns a new PropertyStage', () => {
    const s = PropertyStage.create('captacion')
    const next = s.transitionTo('publicada')
    expect(next.value).toBe('publicada')
  })

  it('transitionTo throws on invalid transition', () => {
    const s = PropertyStage.create('captacion')
    expect(() => s.transitionTo('vendida')).toThrow(ValidationError)
  })

  it('toString returns the value', () => {
    expect(PropertyStage.create('captacion').toString()).toBe('captacion')
  })
})
