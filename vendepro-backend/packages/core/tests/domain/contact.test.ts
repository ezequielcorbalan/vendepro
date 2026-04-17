import { describe, it, expect } from 'vitest'
import { Contact } from '../../src/domain/entities/contact'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'cnt-1',
  org_id: 'org_mg',
  full_name: 'María García',
  phone: '1134567890',
  email: 'maria@example.com',
  contact_type: 'propietario',
  neighborhood: 'Palermo',
  notes: null,
  source: 'referido',
  agent_id: 'agent-1',
}

describe('Contact entity', () => {
  it('creates a valid contact', () => {
    const c = Contact.create(baseProps)
    expect(c.id).toBe('cnt-1')
    expect(c.full_name).toBe('María García')
    expect(c.email).toBe('maria@example.com')
    expect(c.phone).toBe('1134567890')
    expect(c.created_at).toBeDefined()
  })

  it('creates a contact without email', () => {
    const c = Contact.create({ ...baseProps, email: null })
    expect(c.email).toBeNull()
  })

  it('throws if full_name is empty', () => {
    expect(() => Contact.create({ ...baseProps, full_name: '' })).toThrow(ValidationError)
  })

  it('throws if full_name is only whitespace', () => {
    expect(() => Contact.create({ ...baseProps, full_name: '   ' })).toThrow(ValidationError)
  })

  it('throws if email is invalid', () => {
    expect(() => Contact.create({ ...baseProps, email: 'not-an-email' })).toThrow(ValidationError)
  })

  it('throws for another invalid email shape', () => {
    expect(() => Contact.create({ ...baseProps, email: 'a@b' })).toThrow(ValidationError)
  })

  it('respects created_at if provided', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const c = Contact.create({ ...baseProps, created_at: fixed })
    expect(c.created_at).toBe(fixed)
  })

  it('auto-generates created_at if not provided', () => {
    const c = Contact.create(baseProps)
    expect(() => new Date(c.created_at).toISOString()).not.toThrow()
  })

  it('toObject round-trips full state', () => {
    const c = Contact.create(baseProps)
    const obj = c.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.full_name).toBe(baseProps.full_name)
    expect(obj.phone).toBe(baseProps.phone)
    expect(obj.email).toBe(baseProps.email)
    expect(obj.contact_type).toBe(baseProps.contact_type)
    expect(obj.neighborhood).toBe(baseProps.neighborhood)
    expect(obj.notes).toBe(baseProps.notes)
    expect(obj.source).toBe(baseProps.source)
    expect(obj.agent_id).toBe(baseProps.agent_id)
    expect(obj.created_at).toBe(c.created_at)
  })
})
