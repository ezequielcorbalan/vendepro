import { describe, it, expect } from 'vitest'
import { VisitForm } from '../../src/domain/entities/visit-form'
import type { VisitFormField } from '../../src/domain/entities/visit-form'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseFields: VisitFormField[] = [
  { key: 'name', label: 'Nombre', type: 'text', required: true },
  { key: 'phone', label: 'Teléfono', type: 'phone', required: true },
  { key: 'motivo', label: 'Motivo', type: 'select', required: false, options: ['compra', 'alquiler'] },
]

const base = {
  id: 'vf-1',
  org_id: 'org_mg',
  property_id: 'prop-1',
  public_slug: 'visita-depto-palermo-abc123',
  fields: baseFields,
}

describe('VisitForm entity', () => {
  it('creates a valid visit form', () => {
    const vf = VisitForm.create(base)
    expect(vf.public_slug).toBe('visita-depto-palermo-abc123')
    expect(vf.fields.length).toBe(3)
    expect(vf.created_at).toBeDefined()
    expect(vf.updated_at).toBeDefined()
  })

  it('rejects empty slug', () => {
    expect(() => VisitForm.create({ ...base, public_slug: '' })).toThrow(ValidationError)
  })

  it('rejects slug with spaces', () => {
    expect(() => VisitForm.create({ ...base, public_slug: 'mi slug' })).toThrow(ValidationError)
  })

  it('rejects slug with special chars', () => {
    expect(() => VisitForm.create({ ...base, public_slug: 'slug_with_underscore!' })).toThrow(ValidationError)
  })

  it('rejects empty fields array', () => {
    expect(() => VisitForm.create({ ...base, fields: [] })).toThrow(ValidationError)
  })

  it('toObject round-trips', () => {
    const vf = VisitForm.create(base)
    const obj = vf.toObject()
    expect(obj.id).toBe(base.id)
    expect(obj.org_id).toBe(base.org_id)
    expect(obj.property_id).toBe(base.property_id)
    expect(obj.public_slug).toBe(base.public_slug)
    expect(obj.fields).toEqual(baseFields)
    expect(obj.created_at).toBeDefined()
    expect(obj.updated_at).toBeDefined()
  })
})
