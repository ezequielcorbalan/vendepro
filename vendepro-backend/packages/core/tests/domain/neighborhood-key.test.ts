import { describe, it, expect } from 'vitest'
import { neighborhoodKey } from '../../src/domain/rules/neighborhood-key'

describe('neighborhoodKey', () => {
  it('unifica mayúsculas, tildes y espacios', () => {
    expect(neighborhoodKey('Villa Urquiza')).toBe('villa urquiza')
    expect(neighborhoodKey('villa urquiza ')).toBe('villa urquiza')
    expect(neighborhoodKey('Villa Urquíza')).toBe('villa urquiza')
    expect(neighborhoodKey('  VILLA   URQUIZA  ')).toBe('villa urquiza')
  })

  it('las variantes reales de producción colapsan en la misma clave', () => {
    expect(neighborhoodKey('villa pueyrreedon')).not.toBe(neighborhoodKey('Villa Pueyrredón'))
    // ↑ typo real (doble e): NO es la misma clave — la normalización no corrige
    // errores de tipeo, solo casing/tildes/espacios. Documentado a propósito.
    expect(neighborhoodKey('Villa Pueyrredón')).toBe(neighborhoodKey('villa pueyrredon'))
  })

  it('vacío o null cae en "sin barrio"', () => {
    expect(neighborhoodKey('')).toBe('sin barrio')
    expect(neighborhoodKey('   ')).toBe('sin barrio')
    expect(neighborhoodKey(null)).toBe('sin barrio')
    expect(neighborhoodKey(undefined)).toBe('sin barrio')
  })
})
