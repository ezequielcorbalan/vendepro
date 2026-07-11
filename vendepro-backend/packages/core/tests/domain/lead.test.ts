import { describe, it, expect } from 'vitest'
import { Lead } from '../../src/domain/entities/lead'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'lead-1',
  org_id: 'org_mg',
  full_name: 'Juan Pérez',
  phone: '1134567890',
  email: null,
  source: 'manual',
  source_detail: null,
  property_address: null,
  neighborhood: 'Palermo',
  property_type: 'departamento',
  operation: 'venta',
  stage: 'nuevo' as const,
  assigned_to: 'agent-1',
  notes: null,
  estimated_value: null,
  budget: null,
  timing: null,
  personas_trabajo: null,
  mascotas: null,
  next_step: null,
  next_step_date: null,
  lost_reason: null,
  first_contact_at: null,
}

describe('Lead entity', () => {
  it('creates a valid lead', () => {
    const lead = Lead.create(baseProps)
    expect(lead.full_name).toBe('Juan Pérez')
    expect(lead.stage).toBe('nuevo')
    expect(lead.created_at).toBeDefined()
  })

  it('throws if full_name is too short', () => {
    expect(() => Lead.create({ ...baseProps, full_name: 'J' })).toThrow(ValidationError)
  })

  it('throws if email format is invalid', () => {
    expect(() => Lead.create({ ...baseProps, email: 'not-an-email' })).toThrow(ValidationError)
  })

  it('throws if stage is invalid', () => {
    expect(() => Lead.create({ ...baseProps, stage: 'invalid_stage' as any })).toThrow(ValidationError)
  })

  it('throws if operation is invalid', () => {
    expect(() => Lead.create({ ...baseProps, operation: 'compra' })).toThrow(ValidationError)
  })

  it('advances stage correctly', () => {
    const lead = Lead.create(baseProps)
    lead.advanceStage('contactado')
    expect(lead.stage).toBe('contactado')
  })

  it('sets firstContactAt when transitioning nuevo→contactado', () => {
    const lead = Lead.create(baseProps)
    const { firstContactAt } = lead.advanceStage('contactado')
    expect(firstContactAt).not.toBeNull()
    expect(lead.first_contact_at).not.toBeNull()
  })

  it('throws if stage transition is invalid', () => {
    const lead = Lead.create(baseProps)
    expect(() => lead.advanceStage('captado')).toThrow(ValidationError)
  })

  it('computes checklist score', () => {
    const lead = Lead.create({ ...baseProps, phone: '1134567890', neighborhood: 'Palermo', operation: 'venta' })
    const score = lead.getChecklistScore()
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('detects urgency for uncontacted nuevo lead', () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const lead = Lead.create({ ...baseProps, created_at: yesterday, updated_at: yesterday })
    expect(lead.getUrgency()).toBe('danger')
  })

  it('returns ok urgency for fresh lead', () => {
    const lead = Lead.create(baseProps)
    expect(lead.getUrgency()).toBe('ok')
  })

  it('needsFollowupEvent is true for presentada stage', () => {
    const lead = Lead.create({ ...baseProps, stage: 'presentada' as any })
    expect(lead.needsFollowupEvent()).toBe(true)
  })

  it('defaults pipeline to vendedor', () => {
    const lead = Lead.create(baseProps)
    expect(lead.pipeline).toBe('vendedor')
  })
})

describe('Lead entity — pipeline comprador', () => {
  const buyerProps = { ...baseProps, pipeline: 'comprador' as const }

  it('creates a buyer lead with buyer stages', () => {
    const lead = Lead.create({ ...buyerProps, stage: 'visita_agendada' as any })
    expect(lead.pipeline).toBe('comprador')
    expect(lead.stage).toBe('visita_agendada')
  })

  it('rejects vendor stages on buyer leads', () => {
    expect(() => Lead.create({ ...buyerProps, stage: 'en_tasacion' as any })).toThrow(ValidationError)
    expect(() => Lead.create({ ...buyerProps, stage: 'captado' as any })).toThrow(ValidationError)
  })

  it('rejects buyer stages on vendor leads', () => {
    expect(() => Lead.create({ ...baseProps, stage: 'oferta' as any })).toThrow(ValidationError)
  })

  it('advanceStage uses the buyer state machine', () => {
    const lead = Lead.create(buyerProps)
    lead.advanceStage('contactado')
    lead.advanceStage('calificado')
    lead.advanceStage('visita_agendada')
    expect(lead.stage).toBe('visita_agendada')
    expect(() => lead.advanceStage('cerrado' as any)).toThrow(ValidationError)
  })

  it('sets firstContactAt on nuevo→contactado for buyers too', () => {
    const lead = Lead.create(buyerProps)
    const { firstContactAt } = lead.advanceStage('contactado')
    expect(firstContactAt).not.toBeNull()
  })

  it('overrideStage rejects stages from the other pipeline', () => {
    const lead = Lead.create(buyerProps)
    expect(() => lead.overrideStage('captado' as any)).toThrow(ValidationError)
    lead.overrideStage('oferta' as any)
    expect(lead.stage).toBe('oferta')
  })

  it('update cannot change the pipeline', () => {
    const lead = Lead.create(buyerProps)
    lead.update({ pipeline: 'vendedor', notes: 'x' } as any)
    expect(lead.pipeline).toBe('comprador')
    expect(lead.notes).toBe('x')
  })

  it('cerrado is ok urgency (not urgent)', () => {
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const lead = Lead.create({ ...buyerProps, stage: 'cerrado' as any, created_at: old, updated_at: old })
    expect(lead.getUrgency()).toBe('ok')
  })
})
