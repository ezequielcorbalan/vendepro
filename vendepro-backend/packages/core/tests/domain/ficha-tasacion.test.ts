import { describe, it, expect } from 'vitest'
import { FichaTasacion } from '../../src/domain/entities/ficha-tasacion'

const baseProps = {
  id: 'ft-1',
  org_id: 'org_mg',
  agent_id: 'agent-1',
  lead_id: 'lead-1',
  appraisal_id: null,
  inspection_date: '2026-04-10',
  address: 'Av. Corrientes 1234',
  neighborhood: 'Almagro',
  property_type: 'departamento',
  floor_number: '4',
  elevators: '2',
  age: '20',
  building_category: 'A',
  property_condition: 'bueno',
  covered_area: 80,
  semi_area: 5,
  uncovered_area: 0,
  m2_value_neighborhood: 2500,
  m2_value_zone: 2400,
  bedrooms: 2,
  bathrooms: 1,
  storage_rooms: 1,
  parking_spots: 1,
  air_conditioning: 1,
  bedroom_dimensions: '4x3',
  living_dimensions: '5x4',
  kitchen_dimensions: '3x2',
  bathroom_dimensions: '2x2',
  floor_type: 'madera',
  disposition: 'frente',
  orientation: 'norte',
  balcony_type: 'balcon',
  heating_type: 'radiadores',
  noise_level: 'bajo',
  amenities: 'pileta',
  is_professional: 0,
  is_occupied: 0,
  is_credit_eligible: 1,
  sells_to_buy: 0,
  expenses: 25000,
  abl: 3000,
  aysa: 2000,
  notes: null,
  photos: null,
}

describe('FichaTasacion entity', () => {
  it('creates a valid ficha', () => {
    const f = FichaTasacion.create(baseProps)
    expect(f.id).toBe('ft-1')
    expect(f.org_id).toBe('org_mg')
    expect(f.agent_id).toBe('agent-1')
    expect(f.lead_id).toBe('lead-1')
    expect(f.address).toBe('Av. Corrientes 1234')
    expect(f.created_at).toBeDefined()
    expect(f.updated_at).toBeDefined()
  })

  it('auto-generates created_at and updated_at if not provided', () => {
    const f = FichaTasacion.create(baseProps)
    expect(() => new Date(f.created_at).toISOString()).not.toThrow()
    expect(() => new Date(f.updated_at).toISOString()).not.toThrow()
  })

  it('respects provided created_at and updated_at', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const f = FichaTasacion.create({ ...baseProps, created_at: fixed, updated_at: fixed })
    expect(f.created_at).toBe(fixed)
    expect(f.updated_at).toBe(fixed)
  })

  it('creates a ficha with minimal optional fields', () => {
    const minimal = { ...baseProps, lead_id: null, appraisal_id: null, inspection_date: null, neighborhood: null, property_type: null }
    const f = FichaTasacion.create(minimal)
    expect(f.lead_id).toBeNull()
    expect(f.appraisal_id).toBeNull()
  })

  it('toObject round-trips the full state', () => {
    const f = FichaTasacion.create(baseProps)
    const obj = f.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.agent_id).toBe(baseProps.agent_id)
    expect(obj.address).toBe(baseProps.address)
    expect(obj.neighborhood).toBe(baseProps.neighborhood)
    expect(obj.covered_area).toBe(baseProps.covered_area)
    expect(obj.bedrooms).toBe(baseProps.bedrooms)
    expect(obj.bathrooms).toBe(baseProps.bathrooms)
    expect(obj.expenses).toBe(baseProps.expenses)
    expect(obj.abl).toBe(baseProps.abl)
    expect(obj.aysa).toBe(baseProps.aysa)
    expect(obj.is_credit_eligible).toBe(baseProps.is_credit_eligible)
    expect(obj.is_professional).toBe(baseProps.is_professional)
    expect(obj.is_occupied).toBe(baseProps.is_occupied)
    expect(obj.sells_to_buy).toBe(baseProps.sells_to_buy)
    expect(obj.created_at).toBe(f.created_at)
    expect(obj.updated_at).toBe(f.updated_at)
  })
})
