import { describe, it, expect } from 'vitest'
import { Email } from '../../src/domain/value-objects/email'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('Email value object', () => {
  it('creates valid email', () => {
    const email = Email.create('foo@bar.com')
    expect(email.value).toBe('foo@bar.com')
  })

  it('lowercases the value', () => {
    const email = Email.create('Foo@Bar.COM')
    expect(email.value).toBe('foo@bar.com')
  })

  it('rejects leading/trailing whitespace (regex runs before trim)', () => {
    // Implementation validates the raw input with /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    // BEFORE applying .trim(), so padded strings are rejected.
    expect(() => Email.create('  foo@bar.com  ')).toThrow(ValidationError)
  })

  it('throws for empty string', () => {
    expect(() => Email.create('')).toThrow(ValidationError)
  })

  it('throws when missing @', () => {
    expect(() => Email.create('foobar.com')).toThrow(ValidationError)
  })

  it('throws when missing domain', () => {
    expect(() => Email.create('foo@')).toThrow(ValidationError)
  })

  it('throws when missing TLD', () => {
    expect(() => Email.create('foo@bar')).toThrow(ValidationError)
  })

  it('throws when contains whitespace', () => {
    expect(() => Email.create('foo @bar.com')).toThrow(ValidationError)
  })

  it('throws for null/undefined coerced', () => {
    expect(() => Email.create(null as unknown as string)).toThrow(ValidationError)
    expect(() => Email.create(undefined as unknown as string)).toThrow(ValidationError)
  })

  it('toString returns the value', () => {
    const email = Email.create('foo@bar.com')
    expect(email.toString()).toBe('foo@bar.com')
  })

  it('equals returns true for same value', () => {
    const a = Email.create('foo@bar.com')
    const b = Email.create('foo@bar.com')
    expect(a.equals(b)).toBe(true)
  })

  it('equals returns true with different casing (normalized)', () => {
    const a = Email.create('foo@bar.com')
    const b = Email.create('FOO@BAR.COM')
    expect(a.equals(b)).toBe(true)
  })

  it('equals returns false for different values', () => {
    const a = Email.create('foo@bar.com')
    const b = Email.create('baz@bar.com')
    expect(a.equals(b)).toBe(false)
  })
})
