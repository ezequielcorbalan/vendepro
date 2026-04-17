import { describe, it, expect } from 'vitest'
import { User } from '../../src/domain/entities/user'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'usr-1',
  email: 'ezequiel@example.com',
  password_hash: 'hashed-password',
  full_name: 'Ezequiel Corbalán',
  phone: '1134567890',
  photo_url: null,
  role: 'agent' as const,
  org_id: 'org_mg',
  active: 1,
}

describe('User entity', () => {
  it('creates a valid user', () => {
    const u = User.create(baseProps)
    expect(u.id).toBe('usr-1')
    expect(u.email).toBe('ezequiel@example.com')
    expect(u.full_name).toBe('Ezequiel Corbalán')
    expect(u.name).toBe('Ezequiel Corbalán')
    expect(u.role).toBe('agent')
    expect(u.org_id).toBe('org_mg')
    expect(u.active).toBe(1)
    expect(u.created_at).toBeDefined()
  })

  it('lowercases email', () => {
    const u = User.create({ ...baseProps, email: 'EZE@Example.COM' })
    expect(u.email).toBe('eze@example.com')
  })

  it('rejects email with surrounding whitespace (regex is strict, runs before trim)', () => {
    expect(() => User.create({ ...baseProps, email: '  eze@example.com  ' })).toThrow(ValidationError)
  })

  it('defaults active to 1 when not provided', () => {
    const props: any = { ...baseProps }
    delete props.active
    const u = User.create(props)
    expect(u.active).toBe(1)
  })

  it('throws if email is empty', () => {
    expect(() => User.create({ ...baseProps, email: '' })).toThrow(ValidationError)
  })

  it('throws if email has invalid format (no @)', () => {
    expect(() => User.create({ ...baseProps, email: 'notanemail' })).toThrow(ValidationError)
  })

  it('throws if email has invalid format (missing TLD)', () => {
    expect(() => User.create({ ...baseProps, email: 'a@b' })).toThrow(ValidationError)
  })

  it('throws if full_name is empty', () => {
    expect(() => User.create({ ...baseProps, full_name: '' })).toThrow(ValidationError)
  })

  it('throws if full_name is only whitespace', () => {
    expect(() => User.create({ ...baseProps, full_name: '   ' })).toThrow(ValidationError)
  })

  it('throws if role is invalid', () => {
    expect(() => User.create({ ...baseProps, role: 'superhero' as any })).toThrow(ValidationError)
  })

  it('accepts all valid roles', () => {
    for (const role of ['owner', 'admin', 'supervisor', 'agent'] as const) {
      const u = User.create({ ...baseProps, role })
      expect(u.role).toBe(role)
    }
  })

  it('isAdmin() returns true for admin role', () => {
    const u = User.create({ ...baseProps, role: 'admin' })
    expect(u.isAdmin()).toBe(true)
  })

  it('isAdmin() returns true for owner role', () => {
    const u = User.create({ ...baseProps, role: 'owner' })
    expect(u.isAdmin()).toBe(true)
  })

  it('isAdmin() returns false for agent role', () => {
    const u = User.create({ ...baseProps, role: 'agent' })
    expect(u.isAdmin()).toBe(false)
  })

  it('isAdmin() returns false for supervisor role', () => {
    const u = User.create({ ...baseProps, role: 'supervisor' })
    expect(u.isAdmin()).toBe(false)
  })

  it('updatePassword() updates password_hash', () => {
    const u = User.create(baseProps)
    u.updatePassword('new-hash')
    expect(u.password_hash).toBe('new-hash')
  })

  it('deactivate() sets active to 0', () => {
    const u = User.create(baseProps)
    expect(u.active).toBe(1)
    u.deactivate()
    expect(u.active).toBe(0)
  })

  it('respects created_at if provided', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const u = User.create({ ...baseProps, created_at: fixed })
    expect(u.created_at).toBe(fixed)
  })

  it('toObject round-trips full state', () => {
    const u = User.create(baseProps)
    const obj = u.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.email).toBe(baseProps.email)
    expect(obj.password_hash).toBe(baseProps.password_hash)
    expect(obj.full_name).toBe(baseProps.full_name)
    expect(obj.phone).toBe(baseProps.phone)
    expect(obj.photo_url).toBe(baseProps.photo_url)
    expect(obj.role).toBe(baseProps.role)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.active).toBe(baseProps.active)
    expect(obj.created_at).toBe(u.created_at)
  })
})
