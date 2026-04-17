import { describe, it, expect } from 'vitest'
import { Objective } from '../../src/domain/entities/objective'

const baseProps = {
  id: 'obj-1',
  org_id: 'org_mg',
  agent_id: 'agent-1',
  metric: 'leads_captured',
  target: 10,
  period_type: 'monthly',
  period_start: '2026-04-01',
  period_end: '2026-04-30',
}

describe('Objective entity', () => {
  it('creates a valid objective', () => {
    const o = Objective.create(baseProps)
    expect(o.id).toBe('obj-1')
    expect(o.org_id).toBe('org_mg')
    expect(o.agent_id).toBe('agent-1')
    expect(o.metric).toBe('leads_captured')
    expect(o.target).toBe(10)
    expect(o.period_type).toBe('monthly')
    expect(o.period_start).toBe('2026-04-01')
    expect(o.period_end).toBe('2026-04-30')
    expect(o.created_at).toBeDefined()
    expect(o.updated_at).toBeDefined()
  })

  it('auto-generates created_at and updated_at if not provided', () => {
    const o = Objective.create(baseProps)
    expect(() => new Date(o.created_at).toISOString()).not.toThrow()
    expect(() => new Date(o.updated_at).toISOString()).not.toThrow()
  })

  it('respects provided created_at and updated_at', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const o = Objective.create({ ...baseProps, created_at: fixed, updated_at: fixed })
    expect(o.created_at).toBe(fixed)
    expect(o.updated_at).toBe(fixed)
  })

  it('supports different metric and period types', () => {
    const o = Objective.create({
      ...baseProps,
      metric: 'sales_closed',
      period_type: 'quarterly',
      target: 3,
    })
    expect(o.metric).toBe('sales_closed')
    expect(o.period_type).toBe('quarterly')
    expect(o.target).toBe(3)
  })

  it('toObject round-trips full state', () => {
    const o = Objective.create(baseProps)
    const obj = o.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.agent_id).toBe(baseProps.agent_id)
    expect(obj.metric).toBe(baseProps.metric)
    expect(obj.target).toBe(baseProps.target)
    expect(obj.period_type).toBe(baseProps.period_type)
    expect(obj.period_start).toBe(baseProps.period_start)
    expect(obj.period_end).toBe(baseProps.period_end)
    expect(obj.created_at).toBe(o.created_at)
    expect(obj.updated_at).toBe(o.updated_at)
  })
})
