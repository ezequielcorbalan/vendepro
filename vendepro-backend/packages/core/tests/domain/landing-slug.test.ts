import { describe, it, expect } from 'vitest'
import { LandingSlug, generateSlugSuffix, SLUG_SUFFIX_ALPHABET } from '../../src/domain/value-objects/landing-slug'

describe('LandingSlug', () => {
  it('crea a partir de slug_base + slug_suffix válidos', () => {
    const s = LandingSlug.create({ slug_base: 'palermo-soho', slug_suffix: 'k7xm3' })
    expect(s.full).toBe('palermo-soho-k7xm3')
  })

  it('rechaza slug_base con mayúsculas', () => {
    expect(() => LandingSlug.create({ slug_base: 'Palermo', slug_suffix: 'k7xm3' })).toThrow()
  })

  it('rechaza slug_base con espacios', () => {
    expect(() => LandingSlug.create({ slug_base: 'palermo soho', slug_suffix: 'k7xm3' })).toThrow()
  })

  it('rechaza slug_base demasiado corto', () => {
    expect(() => LandingSlug.create({ slug_base: 'ab', slug_suffix: 'k7xm3' })).toThrow()
  })

  it('rechaza slug_base demasiado largo', () => {
    expect(() => LandingSlug.create({ slug_base: 'a'.repeat(61), slug_suffix: 'k7xm3' })).toThrow()
  })

  it('rechaza slug_suffix con longitud distinta de 5', () => {
    expect(() => LandingSlug.create({ slug_base: 'palermo', slug_suffix: 'abcd' })).toThrow()
    expect(() => LandingSlug.create({ slug_base: 'palermo', slug_suffix: 'abcdef' })).toThrow()
  })

  it('rechaza slug_suffix con caracteres no permitidos', () => {
    expect(() => LandingSlug.create({ slug_base: 'palermo', slug_suffix: 'ABC12' })).toThrow()
  })
})

describe('generateSlugSuffix', () => {
  it('devuelve string de 5 chars del alfabeto', () => {
    const s = generateSlugSuffix()
    expect(s).toMatch(new RegExp(`^[${SLUG_SUFFIX_ALPHABET}]{5}$`))
  })

  it('es aleatorio (10 llamadas generan al menos 5 distintos)', () => {
    const set = new Set(Array.from({ length: 10 }, () => generateSlugSuffix()))
    expect(set.size).toBeGreaterThanOrEqual(5)
  })
})
