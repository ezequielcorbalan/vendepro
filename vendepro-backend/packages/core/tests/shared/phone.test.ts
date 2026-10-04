import { describe, it, expect } from 'vitest'
import { phoneDigits, phoneVariants, normalizePhone, samePhone } from '../../src/shared/phone'

describe('phoneDigits', () => {
  it('deja sólo números', () => {
    expect(phoneDigits('+54 9 11 5555-1234')).toBe('5491155551234')
    expect(phoneDigits(null)).toBe('')
  })
})

describe('normalizePhone', () => {
  it.each([
    ['+54 9 11 5555-1234', '1155551234'],
    ['5491155551234', '1155551234'],
    ['011 15 5555-1234', '1155551234'],
    ['11 5555 1234', '1155551234'],
    ['00 54 11 5555 1234', '1155551234'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizePhone(entrada)).toBe(esperado)
  })

  it('sin dígitos devuelve null', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
})

describe('samePhone', () => {
  it('reconoce el mismo número escrito distinto', () => {
    expect(samePhone('+5491155551234', '11 5555-1234')).toBe(true)
    expect(samePhone('011 15 5555-1234', '5491155551234')).toBe(true)
  })

  it('no confunde números distintos', () => {
    expect(samePhone('1155551234', '1144449999')).toBe(false)
    expect(samePhone('1155551234', null)).toBe(false)
  })
})

describe('phoneVariants', () => {
  it('incluye la forma con y sin prefijos', () => {
    const v = phoneVariants('+54 9 11 5555-1234')
    expect(v).toContain('5491155551234')
    expect(v).toContain('1155551234')
  })

  // El 15 no se puede ubicar sin saber el largo de la característica.
  it('saca el 15 local de característica larga', () => {
    expect(phoneVariants('0221 15 555-1234')).toContain('2215551234')
  })
})
