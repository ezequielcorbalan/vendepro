import { describe, it, expect } from 'vitest'
import { PropertyStage, PROPERTY_STAGES } from '../../src/domain/value-objects/property-stage'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('PropertyStage value object', () => {
  it('exposes the canonical PROPERTY_STAGES list', () => {
    expect(PROPERTY_STAGES).toEqual(['captada', 'documentacion', 'publicada', 'reservada', 'vendida', 'vencida'])
  })

  it.each(PROPERTY_STAGES)('creates valid stage "%s"', (value) => {
    const stage = PropertyStage.create(value)
    expect(stage.value).toBe(value)
  })

  it('throws for invalid stage', () => {
    expect(() => PropertyStage.create('invalid')).toThrow(ValidationError)
  })

  it('allows captada -> documentacion', () => {
    expect(PropertyStage.create('captada').canTransitionTo('documentacion')).toBe(true)
  })

  it('allows captada -> vencida', () => {
    expect(PropertyStage.create('captada').canTransitionTo('vencida')).toBe(true)
  })

  it('blocks captada -> publicada', () => {
    expect(PropertyStage.create('captada').canTransitionTo('publicada')).toBe(false)
  })

  it('allows documentacion -> publicada', () => {
    expect(PropertyStage.create('documentacion').canTransitionTo('publicada')).toBe(true)
  })

  it('allows publicada -> reservada', () => {
    expect(PropertyStage.create('publicada').canTransitionTo('reservada')).toBe(true)
  })

  it('allows reservada -> vendida', () => {
    expect(PropertyStage.create('reservada').canTransitionTo('vendida')).toBe(true)
  })

  it('allows reservada -> publicada (revert if reservation falls through)', () => {
    expect(PropertyStage.create('reservada').canTransitionTo('publicada')).toBe(true)
  })

  it('vendida is terminal', () => {
    const s = PropertyStage.create('vendida')
    expect(s.canTransitionTo('publicada')).toBe(false)
    expect(s.canTransitionTo('vencida')).toBe(false)
  })

  it('vencida is terminal', () => {
    const s = PropertyStage.create('vencida')
    expect(s.canTransitionTo('publicada')).toBe(false)
    expect(s.canTransitionTo('captada')).toBe(false)
  })

  it('transitionTo returns a new PropertyStage', () => {
    const s = PropertyStage.create('captada')
    const next = s.transitionTo('documentacion')
    expect(next.value).toBe('documentacion')
  })

  it('transitionTo throws on invalid transition', () => {
    const s = PropertyStage.create('captada')
    expect(() => s.transitionTo('vendida')).toThrow(ValidationError)
  })

  it('toString returns the value', () => {
    expect(PropertyStage.create('captada').toString()).toBe('captada')
  })
})
