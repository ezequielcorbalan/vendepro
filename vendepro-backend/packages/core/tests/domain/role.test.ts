import { describe, it, expect } from 'vitest'
import { Role } from '../../src/domain/entities/role'
import { ValidationError } from '../../src/domain/errors/validation-error'

const base = {
  id: 1,
  name: 'admin',
  label: 'Administrador',
}

describe('Role entity', () => {
  it('creates a valid role', () => {
    const r = Role.create(base)
    expect(r.id).toBe(1)
    expect(r.name).toBe('admin')
    expect(r.label).toBe('Administrador')
  })

  it('accepts names with underscores', () => {
    const r = Role.create({ ...base, name: 'super_admin' })
    expect(r.name).toBe('super_admin')
  })

  it('rejects name with uppercase', () => {
    expect(() => Role.create({ ...base, name: 'Admin' })).toThrow(ValidationError)
  })

  it('rejects name with spaces', () => {
    expect(() => Role.create({ ...base, name: 'super admin' })).toThrow(ValidationError)
  })

  it('rejects name with digits', () => {
    expect(() => Role.create({ ...base, name: 'admin1' })).toThrow(ValidationError)
  })

  it('rejects empty label', () => {
    expect(() => Role.create({ ...base, label: '' })).toThrow(ValidationError)
  })

  it('rejects whitespace-only label', () => {
    expect(() => Role.create({ ...base, label: '   ' })).toThrow(ValidationError)
  })

  it('toObject round-trips', () => {
    const r = Role.create(base)
    expect(r.toObject()).toEqual(base)
  })
})
