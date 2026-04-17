import { describe, it, expect } from 'vitest'
import { canTransitionPropertyStatus } from '../../src/domain/rules/property-rules'

describe('Property rules — canTransitionPropertyStatus', () => {
  it('active -> sold allowed', () => {
    expect(canTransitionPropertyStatus('active', 'sold')).toBe(true)
  })

  it('active -> suspended allowed', () => {
    expect(canTransitionPropertyStatus('active', 'suspended')).toBe(true)
  })

  it('active -> archived allowed', () => {
    expect(canTransitionPropertyStatus('active', 'archived')).toBe(true)
  })

  it('active -> inactive allowed', () => {
    expect(canTransitionPropertyStatus('active', 'inactive')).toBe(true)
  })

  it('suspended -> active allowed', () => {
    expect(canTransitionPropertyStatus('suspended', 'active')).toBe(true)
  })

  it('suspended -> archived allowed', () => {
    expect(canTransitionPropertyStatus('suspended', 'archived')).toBe(true)
  })

  it('suspended -> sold not allowed', () => {
    expect(canTransitionPropertyStatus('suspended', 'sold')).toBe(false)
  })

  it('inactive -> active allowed', () => {
    expect(canTransitionPropertyStatus('inactive', 'active')).toBe(true)
  })

  it('inactive -> archived allowed', () => {
    expect(canTransitionPropertyStatus('inactive', 'archived')).toBe(true)
  })

  it('sold -> archived allowed', () => {
    expect(canTransitionPropertyStatus('sold', 'archived')).toBe(true)
  })

  it('sold -> active not allowed', () => {
    expect(canTransitionPropertyStatus('sold', 'active')).toBe(false)
  })

  it('archived is terminal', () => {
    expect(canTransitionPropertyStatus('archived', 'active')).toBe(false)
    expect(canTransitionPropertyStatus('archived', 'sold')).toBe(false)
    expect(canTransitionPropertyStatus('archived', 'suspended')).toBe(false)
    expect(canTransitionPropertyStatus('archived', 'inactive')).toBe(false)
  })

  it('returns false for unknown source status', () => {
    expect(canTransitionPropertyStatus('bogus' as never, 'active')).toBe(false)
  })
})
