import { describe, it, expect } from 'vitest'
import { Appraisal } from '../../src/domain/entities/appraisal'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'apr-1',
  org_id: 'org_mg',
  property_address: 'Av. Corrientes 1234',
  neighborhood: 'Almagro',
  city: 'Buenos Aires',
  property_type: 'departamento',
  covered_area: 80,
  total_area: 90,
  semi_area: null,
  weighted_area: 85,
  strengths: null,
  weaknesses: null,
  opportunities: null,
  threats: null,
  publication_analysis: null,
  suggested_price: 150000,
  test_price: null,
  expected_close_price: null,
  usd_per_m2: null,
  canva_design_id: null,
  canva_edit_url: null,
  agent_id: 'agent-1',
  lead_id: null,
  status: 'draft' as const,
  public_slug: null,
}

describe('Appraisal entity', () => {
  it('creates a valid appraisal', () => {
    const apr = Appraisal.create(baseProps)
    expect(apr.id).toBe('apr-1')
    expect(apr.property_address).toBe('Av. Corrientes 1234')
    expect(apr.neighborhood).toBe('Almagro')
    expect(apr.status).toBe('draft')
    expect(apr.created_at).toBeDefined()
    expect(apr.updated_at).toBeDefined()
  })

  it('throws if property_address is empty', () => {
    expect(() => Appraisal.create({ ...baseProps, property_address: '' })).toThrow(ValidationError)
  })

  it('throws if property_address is only whitespace', () => {
    expect(() => Appraisal.create({ ...baseProps, property_address: '   ' })).toThrow(ValidationError)
  })

  it('throws if neighborhood is empty', () => {
    expect(() => Appraisal.create({ ...baseProps, neighborhood: '' })).toThrow(ValidationError)
  })

  it('throws for invalid status', () => {
    expect(() => Appraisal.create({ ...baseProps, status: 'archived' as any })).toThrow(ValidationError)
  })

  it('accepts all valid statuses', () => {
    for (const status of ['draft', 'generated', 'sent'] as const) {
      const apr = Appraisal.create({ ...baseProps, status })
      expect(apr.status).toBe(status)
    }
  })

  it('respects provided created_at and updated_at', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const apr = Appraisal.create({ ...baseProps, created_at: fixed, updated_at: fixed })
    expect(apr.created_at).toBe(fixed)
    expect(apr.updated_at).toBe(fixed)
  })

  it('update() mutates fields and bumps updated_at', async () => {
    const created = '2026-01-01T00:00:00.000Z'
    const apr = Appraisal.create({ ...baseProps, created_at: created, updated_at: created })
    // ensure time advances
    await new Promise((r) => setTimeout(r, 2))
    apr.update({ suggested_price: 200000, status: 'generated' })
    expect(apr.suggested_price).toBe(200000)
    expect(apr.status).toBe('generated')
    expect(apr.updated_at).not.toBe(created)
  })

  it('toObject round-trips main fields', () => {
    const apr = Appraisal.create(baseProps)
    const obj = apr.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.property_address).toBe(baseProps.property_address)
    expect(obj.neighborhood).toBe(baseProps.neighborhood)
    expect(obj.city).toBe(baseProps.city)
    expect(obj.property_type).toBe(baseProps.property_type)
    expect(obj.status).toBe(baseProps.status)
    expect(obj.suggested_price).toBe(baseProps.suggested_price)
    expect(obj.agent_id).toBe(baseProps.agent_id)
  })
})
