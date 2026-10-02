import { describe, it, expect } from 'vitest'
import { leadMatchesSearch, phoneVariants, leadPropertyLabel } from '../lead-search'

const lead = {
  full_name: 'María Núñez',
  phone: '+54 9 11 5555-1234',
  contact_phone: null,
  email: 'maria@example.com',
  property_address: null,
  neighborhood: 'Belgrano',
  linked_properties: 'Av. Cabildo 2040, Belgrano · Juramento 1500',
  source_detail: null,
}

describe('phoneVariants', () => {
  it('saca +54, 9 y 0 de característica', () => {
    expect(phoneVariants('+54 9 11 5555-1234')).toContain('1155551234')
    expect(phoneVariants('011 5555-1234')).toContain('1155551234')
  })
  it('saca el 15 local', () => {
    expect(phoneVariants('011 15 5555-1234')).toContain('1155551234')
    expect(phoneVariants('0221 15 555-1234')).toContain('2215551234')
  })
})

describe('leadMatchesSearch', () => {
  it.each([
    '1155551234',
    '11 5555 1234',
    '5491155551234',
    '011 15 5555-1234',
    '15 5555-1234',
    '5555-12',
    '1234',
  ])('encuentra por teléfono escrito como %s', q => {
    expect(leadMatchesSearch(lead, q)).toBe(true)
  })

  it('no matchea números que no están', () => {
    expect(leadMatchesSearch(lead, '4444-9999')).toBe(false)
  })

  it('usa el teléfono del contacto si el lead no tiene', () => {
    expect(leadMatchesSearch({ ...lead, phone: null, contact_phone: '11-4321-8765' }, '43218765')).toBe(true)
  })

  it('ignora acentos y mayúsculas', () => {
    expect(leadMatchesSearch(lead, 'nunez')).toBe(true)
    expect(leadMatchesSearch(lead, 'MARIA')).toBe(true)
  })

  it('busca en las propiedades vinculadas, altura incluida', () => {
    expect(leadMatchesSearch(lead, 'cabildo')).toBe(true)
    expect(leadMatchesSearch(lead, 'cabildo 2040')).toBe(true)
    expect(leadMatchesSearch(lead, '2040')).toBe(true)
  })

  it('cada palabra puede estar en un campo distinto', () => {
    expect(leadMatchesSearch(lead, 'maria juramento')).toBe(true)
    expect(leadMatchesSearch(lead, 'maria palermo')).toBe(false)
  })
})

describe('leadPropertyLabel', () => {
  it('cae a la propiedad vinculada si el lead no tiene dirección', () => {
    expect(leadPropertyLabel({ linked_properties: 'Juramento 1500' })).toBe('Juramento 1500')
    expect(leadPropertyLabel({ property_address: 'Cabildo 1', linked_properties: 'X' })).toBe('Cabildo 1')
  })
})
