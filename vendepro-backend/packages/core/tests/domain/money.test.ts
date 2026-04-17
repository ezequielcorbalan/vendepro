import { describe, it, expect } from 'vitest'
import { Money } from '../../src/domain/value-objects/money'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('Money value object', () => {
  it('creates USD money', () => {
    const m = Money.create(1000, 'USD')
    expect(m.amount).toBe(1000)
    expect(m.currency).toBe('USD')
  })

  it('creates ARS money', () => {
    const m = Money.create(1000, 'ARS')
    expect(m.amount).toBe(1000)
    expect(m.currency).toBe('ARS')
  })

  it('allows zero amount', () => {
    const m = Money.create(0, 'USD')
    expect(m.amount).toBe(0)
  })

  it('throws for negative amount', () => {
    expect(() => Money.create(-1, 'USD')).toThrow(ValidationError)
  })

  it('throws for NaN amount', () => {
    expect(() => Money.create(Number.NaN, 'USD')).toThrow(ValidationError)
  })

  it('throws for Infinity amount', () => {
    expect(() => Money.create(Number.POSITIVE_INFINITY, 'USD')).toThrow(ValidationError)
  })

  it('throws for invalid currency', () => {
    expect(() => Money.create(100, 'EUR')).toThrow(ValidationError)
  })

  it('throws for empty currency', () => {
    expect(() => Money.create(100, '')).toThrow(ValidationError)
  })

  it('formats USD with "USD" prefix', () => {
    const m = Money.create(1000, 'USD')
    expect(m.format()).toContain('USD')
    expect(m.format()).toContain('1.000')
  })

  it('formats ARS with "$" prefix', () => {
    const m = Money.create(1000, 'ARS')
    expect(m.format()).toContain('$')
    expect(m.format()).toContain('1.000')
  })

  it('equals returns true for same amount and currency', () => {
    const a = Money.create(100, 'USD')
    const b = Money.create(100, 'USD')
    expect(a.equals(b)).toBe(true)
  })

  it('equals returns false for different currency', () => {
    const a = Money.create(100, 'USD')
    const b = Money.create(100, 'ARS')
    expect(a.equals(b)).toBe(false)
  })

  it('equals returns false for different amount', () => {
    const a = Money.create(100, 'USD')
    const b = Money.create(200, 'USD')
    expect(a.equals(b)).toBe(false)
  })
})
