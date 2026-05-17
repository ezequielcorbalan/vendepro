import { describe, it, expect } from 'vitest'
import { LeadStage } from '../../src/domain/value-objects/lead-stage'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('LeadStage value object', () => {
  it('creates valid stage', () => {
    const stage = LeadStage.create('nuevo')
    expect(stage.value).toBe('nuevo')
  })

  it('throws for invalid stage', () => {
    expect(() => LeadStage.create('invalid')).toThrow(ValidationError)
  })

  it('allows valid transitions from nuevo', () => {
    const stage = LeadStage.create('nuevo')
    expect(stage.canTransitionTo('asignado')).toBe(true)
    expect(stage.canTransitionTo('contactado')).toBe(true)
    expect(stage.canTransitionTo('invalido')).toBe(true)
    expect(stage.canTransitionTo('perdido')).toBe(true)
  })

  it('blocks invalid transitions from nuevo', () => {
    const stage = LeadStage.create('nuevo')
    expect(stage.canTransitionTo('captado')).toBe(false)
    expect(stage.canTransitionTo('presentada')).toBe(false)
    expect(stage.canTransitionTo('finalizado')).toBe(false)
  })

  it('allows invalido from any pre-captado stage', () => {
    for (const from of ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'seguimiento'] as const) {
      expect(LeadStage.create(from).canTransitionTo('invalido')).toBe(true)
    }
  })

  it('captado cannot manually go to finalizado or perdido (sync-only)', () => {
    const stage = LeadStage.create('captado')
    expect(stage.canTransitionTo('finalizado', { source: 'user' })).toBe(false)
    expect(stage.canTransitionTo('perdido', { source: 'user' })).toBe(false)
  })

  it('captado can sync-transition to finalizado and perdido', () => {
    const stage = LeadStage.create('captado')
    expect(stage.canTransitionTo('finalizado', { source: 'sync' })).toBe(true)
    expect(stage.canTransitionTo('perdido', { source: 'sync' })).toBe(true)
  })

  it('final terminal states have no outgoing transitions', () => {
    for (const final of ['invalido', 'finalizado', 'perdido'] as const) {
      const stage = LeadStage.create(final)
      expect(stage.canTransitionTo('captado')).toBe(false)
      expect(stage.canTransitionTo('nuevo')).toBe(false)
    }
  })

  it('isFinal returns true for terminal states', () => {
    for (const final of ['invalido', 'finalizado', 'perdido'] as const) {
      expect(LeadStage.create(final).isFinal()).toBe(true)
    }
  })

  it('isFinal returns false for captado (agente-final but not terminal)', () => {
    expect(LeadStage.create('captado').isFinal()).toBe(false)
  })

  it('isAgentFinal returns true for captado and terminals', () => {
    for (const s of ['captado', 'invalido', 'finalizado', 'perdido'] as const) {
      expect(LeadStage.create(s).isAgentFinal()).toBe(true)
    }
  })

  it('transitionTo throws for invalid transition', () => {
    const stage = LeadStage.create('nuevo')
    expect(() => stage.transitionTo('captado')).toThrow(ValidationError)
  })

  it('transitionTo with sync source allows captado->finalizado', () => {
    const stage = LeadStage.create('captado')
    const next = stage.transitionTo('finalizado', { source: 'sync' })
    expect(next.value).toBe('finalizado')
  })

  it('isAgentFinal returns false for non-final non-captado stages', () => {
    for (const s of ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'seguimiento'] as const) {
      expect(LeadStage.create(s).isAgentFinal()).toBe(false)
    }
  })
})
