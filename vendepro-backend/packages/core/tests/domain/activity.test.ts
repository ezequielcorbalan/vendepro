import { describe, it, expect } from 'vitest'
import { Activity } from '../../src/domain/entities/activity'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'act-1',
  org_id: 'org_mg',
  agent_id: 'agent-1',
  activity_type: 'llamada' as const,
  description: 'Llamada inicial',
  result: 'Interesado',
  duration_minutes: 15,
  lead_id: 'lead-1',
  contact_id: null,
  property_id: null,
  appraisal_id: null,
}

describe('Activity entity', () => {
  it('creates a valid activity', () => {
    const act = Activity.create(baseProps)
    expect(act.id).toBe('act-1')
    expect(act.activity_type).toBe('llamada')
    expect(act.description).toBe('Llamada inicial')
    expect(act.duration_minutes).toBe(15)
    expect(act.lead_id).toBe('lead-1')
  })

  it('auto-generates created_at when not provided', () => {
    const act = Activity.create(baseProps)
    expect(act.created_at).toBeDefined()
    expect(() => new Date(act.created_at).toISOString()).not.toThrow()
  })

  it('respects created_at if provided', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const act = Activity.create({ ...baseProps, created_at: fixed })
    expect(act.created_at).toBe(fixed)
  })

  it('throws for invalid activity_type', () => {
    expect(() => Activity.create({ ...baseProps, activity_type: 'fiesta' as any })).toThrow(ValidationError)
  })

  it('accepts all valid activity types', () => {
    const types = ['llamada', 'whatsapp', 'reunion', 'visita_captacion', 'visita_comprador', 'tasacion', 'presentacion', 'seguimiento', 'documentacion', 'admin', 'cierre'] as const
    for (const t of types) {
      const act = Activity.create({ ...baseProps, activity_type: t })
      expect(act.activity_type).toBe(t)
    }
  })

  it('exposes optional joined fields via getters', () => {
    const act = Activity.create({ ...baseProps, agent_name: 'Ana', lead_name: 'Juan' } as any)
    expect(act.agent_name).toBe('Ana')
    expect(act.lead_name).toBe('Juan')
  })

  it('toObject round-trips the full state', () => {
    const act = Activity.create(baseProps)
    const obj = act.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.agent_id).toBe(baseProps.agent_id)
    expect(obj.activity_type).toBe(baseProps.activity_type)
    expect(obj.description).toBe(baseProps.description)
    expect(obj.result).toBe(baseProps.result)
    expect(obj.duration_minutes).toBe(baseProps.duration_minutes)
    expect(obj.lead_id).toBe(baseProps.lead_id)
    expect(obj.contact_id).toBe(baseProps.contact_id)
    expect(obj.property_id).toBe(baseProps.property_id)
    expect(obj.appraisal_id).toBe(baseProps.appraisal_id)
    expect(obj.created_at).toBe(act.created_at)
  })
})
