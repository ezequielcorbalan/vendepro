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

  it('allows valid transitions', () => {
    const stage = LeadStage.create('nuevo')
    expect(stage.canTransitionTo('contactado')).toBe(true)
    expect(stage.canTransitionTo('asignado')).toBe(true)
    expect(stage.canTransitionTo('perdido')).toBe(true)
  })

  it('blocks invalid transitions', () => {
    const stage = LeadStage.create('nuevo')
    expect(stage.canTransitionTo('captado')).toBe(false)
    expect(stage.canTransitionTo('presentada')).toBe(false)
  })

  it('captado is final stage', () => {
    const stage = LeadStage.create('captado')
    expect(stage.isFinal()).toBe(true)
  })

  it('perdido is final stage', () => {
    const stage = LeadStage.create('perdido')
    expect(stage.isFinal()).toBe(true)
  })

  it('transitionTo returns new stage', () => {
    const stage = LeadStage.create('nuevo')
    const next = stage.transitionTo('contactado')
    expect(next.value).toBe('contactado')
  })

  it('transitionTo throws for invalid transition', () => {
    const stage = LeadStage.create('nuevo')
    expect(() => stage.transitionTo('captado')).toThrow(ValidationError)
  })
})
