import { describe, it, expect } from 'vitest'
import { stableStringify } from '../../src/shared/stable-stringify'

describe('stableStringify', () => {
  it('produces identical output for different key orders', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }))
  })

  it('handles nested objects with sorted keys', () => {
    const out = stableStringify({ b: { d: 4, c: 3 }, a: 1 })
    expect(out).toBe('{"a":1,"b":{"c":3,"d":4}}')
  })

  it('preserves array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]')
  })

  it('handles null and primitives', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify(42)).toBe('42')
    expect(stableStringify('hello')).toBe('"hello"')
    expect(stableStringify(true)).toBe('true')
  })

  it('handles array of objects with deterministic output', () => {
    const a = stableStringify([{ x: 1, y: 2 }, { y: 3, x: 4 }])
    const b = stableStringify([{ y: 2, x: 1 }, { x: 4, y: 3 }])
    expect(a).toBe(b)
  })
})
