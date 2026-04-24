import { describe, it, expect } from 'vitest'
import { assertBindingMode, BINDING_MODES } from '../../src/domain/value-objects/appraisal-binding-mode'

describe('BindingMode', () => {
  it('accepts all 5 valid modes', () => {
    for (const m of BINDING_MODES) {
      expect(() => assertBindingMode(m)).not.toThrow()
    }
  })

  it('rejects unknown mode', () => {
    expect(() => assertBindingMode('garbage')).toThrow(/binding_mode inválido/)
  })
})
