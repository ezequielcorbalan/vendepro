import { describe, it, expect } from 'vitest'
import { Property } from '../../src/domain/entities/property'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'prop-1',
  address: 'Av. Corrientes 1234',
  neighborhood: 'Almagro',
  city: 'Buenos Aires',
  property_type: 'departamento' as const,
  rooms: 3,
  size_m2: 80,
  asking_price: 120000,
  currency: 'USD' as const,
  owner_name: 'María García',
  owner_phone: '1134567890',
  owner_email: null,
  public_slug: 'av-corrientes-1234-almagro',
  cover_photo: null,
  agent_id: 'agent-1',
  org_id: 'org_mg',
  status: 'active' as const,
  commercial_stage: null,
}

describe('Property entity', () => {
  it('creates a valid property', () => {
    const prop = Property.create(baseProps)
    expect(prop.address).toBe('Av. Corrientes 1234')
    expect(prop.status).toBe('active')
  })

  it('throws if address is empty', () => {
    expect(() => Property.create({ ...baseProps, address: '' })).toThrow(ValidationError)
  })

  it('throws if owner_name is empty', () => {
    expect(() => Property.create({ ...baseProps, owner_name: '' })).toThrow(ValidationError)
  })

  it('throws for invalid property_type', () => {
    expect(() => Property.create({ ...baseProps, property_type: 'galpón' as any })).toThrow(ValidationError)
  })

  it('updates status via valid transition', () => {
    const prop = Property.create(baseProps)
    prop.updateStatus('sold')
    expect(prop.status).toBe('sold')
  })

  it('throws for invalid status transition', () => {
    const prop = Property.create({ ...baseProps, status: 'sold' })
    expect(() => prop.updateStatus('active')).toThrow(ValidationError)
  })

  it('updates price', () => {
    const prop = Property.create(baseProps)
    prop.updatePrice(130000, 'USD')
    expect(prop.asking_price).toBe(130000)
  })

  it('throws for invalid price', () => {
    const prop = Property.create(baseProps)
    expect(() => prop.updatePrice(-1, 'USD')).toThrow(ValidationError)
  })
})
