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

describe('LeadStage — pipeline comprador', () => {
  it('creates buyer stages', () => {
    const stage = LeadStage.create('visita_agendada', 'comprador')
    expect(stage.value).toBe('visita_agendada')
    expect(stage.pipeline).toBe('comprador')
  })

  it('rejects vendor-only stages in comprador pipeline', () => {
    for (const s of ['asignado', 'en_tasacion', 'presentada', 'seguimiento', 'captado', 'finalizado']) {
      expect(() => LeadStage.create(s, 'comprador')).toThrow(ValidationError)
    }
  })

  it('rejects buyer-only stages in vendedor pipeline (default)', () => {
    for (const s of ['visita_agendada', 'visito', 'oferta', 'cerrado']) {
      expect(() => LeadStage.create(s)).toThrow(ValidationError)
    }
  })

  it('follows the happy path nuevo → ... → cerrado', () => {
    let stage = LeadStage.create('nuevo', 'comprador')
    for (const next of ['contactado', 'calificado', 'visita_agendada', 'visito', 'oferta', 'cerrado'] as const) {
      stage = stage.transitionTo(next)
    }
    expect(stage.value).toBe('cerrado')
    expect(stage.pipeline).toBe('comprador')
  })

  it('allows the visit loop: visito → visita_agendada', () => {
    const stage = LeadStage.create('visito', 'comprador')
    expect(stage.canTransitionTo('visita_agendada')).toBe(true)
  })

  it('allows fallen offer: oferta → visito', () => {
    const stage = LeadStage.create('oferta', 'comprador')
    expect(stage.canTransitionTo('visito')).toBe(true)
  })

  it('blocks skipping stages', () => {
    expect(LeadStage.create('nuevo', 'comprador').canTransitionTo('visita_agendada')).toBe(false)
    expect(LeadStage.create('contactado', 'comprador').canTransitionTo('oferta')).toBe(false)
    expect(LeadStage.create('calificado', 'comprador').canTransitionTo('cerrado')).toBe(false)
  })

  it('allows invalido/perdido from any active stage', () => {
    for (const from of ['nuevo', 'contactado', 'calificado', 'visita_agendada', 'visito', 'oferta'] as const) {
      expect(LeadStage.create(from, 'comprador').canTransitionTo('invalido')).toBe(true)
      expect(LeadStage.create(from, 'comprador').canTransitionTo('perdido')).toBe(true)
    }
  })

  it('terminal buyer states have no outgoing transitions (manual ni sync)', () => {
    for (const final of ['cerrado', 'invalido', 'perdido'] as const) {
      const stage = LeadStage.create(final, 'comprador')
      expect(stage.canTransitionTo('nuevo')).toBe(false)
      expect(stage.canTransitionTo('visito', { source: 'sync' })).toBe(false)
    }
  })

  it('isFinal/isAgentFinal treat cerrado as terminal', () => {
    expect(LeadStage.create('cerrado', 'comprador').isFinal()).toBe(true)
    expect(LeadStage.create('cerrado', 'comprador').isAgentFinal()).toBe(true)
    expect(LeadStage.create('oferta', 'comprador').isFinal()).toBe(false)
    expect(LeadStage.create('oferta', 'comprador').isAgentFinal()).toBe(false)
  })

  it('transitionTo keeps the pipeline', () => {
    const next = LeadStage.create('nuevo', 'comprador').transitionTo('contactado')
    expect(next.pipeline).toBe('comprador')
  })

  it('rejects an unknown pipeline', () => {
    expect(() => LeadStage.create('nuevo', 'inversor' as any)).toThrow(ValidationError)
  })
})
