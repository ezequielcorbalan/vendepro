import { describe, it, expect } from 'vitest'
import { PropertyStage } from '../../src/domain/value-objects/property-stage'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('PropertyStage value object', () => {
  it('accepts new stages: propuesta, invalida, perdida', () => {
    expect(PropertyStage.create('propuesta').value).toBe('propuesta')
    expect(PropertyStage.create('invalida').value).toBe('invalida')
    expect(PropertyStage.create('perdida').value).toBe('perdida')
  })

  it('rejects unknown stage', () => {
    expect(() => PropertyStage.create('foo')).toThrow(ValidationError)
  })

  it('propuesta can go to captada or invalida', () => {
    const s = PropertyStage.create('propuesta')
    expect(s.canTransitionTo('captada')).toBe(true)
    expect(s.canTransitionTo('invalida')).toBe(true)
    expect(s.canTransitionTo('publicada')).toBe(false)
  })

  it('captada can branch to documentacion, publicada, perdida, invalida, suspendida', () => {
    const s = PropertyStage.create('captada')
    expect(s.canTransitionTo('documentacion')).toBe(true)
    expect(s.canTransitionTo('publicada')).toBe(true)
    expect(s.canTransitionTo('perdida')).toBe(true)
    expect(s.canTransitionTo('invalida')).toBe(true)
    expect(s.canTransitionTo('suspendida')).toBe(true)
  })

  it('reservada can go to vendida (manual or sync)', () => {
    const s = PropertyStage.create('reservada')
    expect(s.canTransitionTo('vendida')).toBe(true)
  })

  it('publicada can go to perdida', () => {
    expect(PropertyStage.create('publicada').canTransitionTo('perdida')).toBe(true)
  })

  it('suspendida is reversible to publicada and reservada', () => {
    const s = PropertyStage.create('suspendida')
    expect(s.canTransitionTo('publicada')).toBe(true)
    expect(s.canTransitionTo('reservada')).toBe(true)
    expect(s.canTransitionTo('archivada')).toBe(true)
  })

  it('vencida can renew to publicada or archive', () => {
    const s = PropertyStage.create('vencida')
    expect(s.canTransitionTo('publicada')).toBe(true)
    expect(s.canTransitionTo('archivada')).toBe(true)
    expect(s.canTransitionTo('captada')).toBe(false)
  })

  it('terminal stages (vendida/perdida/invalida) can only go to archivada', () => {
    for (const t of ['vendida', 'perdida', 'invalida'] as const) {
      const s = PropertyStage.create(t)
      expect(s.canTransitionTo('archivada')).toBe(true)
      expect(s.canTransitionTo('captada')).toBe(false)
    }
  })

  it('archivada has no outgoing transitions', () => {
    const s = PropertyStage.create('archivada')
    expect(s.canTransitionTo('captada')).toBe(false)
    expect(s.canTransitionTo('publicada')).toBe(false)
  })

  it('transitionTo throws on invalid', () => {
    const s = PropertyStage.create('propuesta')
    expect(() => s.transitionTo('vendida')).toThrow(ValidationError)
  })

  it('isFinal returns true for vendida/perdida/invalida/archivada', () => {
    for (const f of ['vendida', 'perdida', 'invalida', 'archivada'] as const) {
      expect(PropertyStage.create(f).isFinal()).toBe(true)
    }
  })

  it('isFinal returns false for non-terminal', () => {
    expect(PropertyStage.create('propuesta').isFinal()).toBe(false)
    expect(PropertyStage.create('captada').isFinal()).toBe(false)
    expect(PropertyStage.create('suspendida').isFinal()).toBe(false)
  })
})
