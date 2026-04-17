import { describe, it, expect } from 'vitest'
import { VisitFormResponse } from '../../src/domain/entities/visit-form-response'
import { ValidationError } from '../../src/domain/errors/validation-error'

const base = {
  id: 'vfr-1',
  form_id: 'vf-1',
  visitor_name: 'María López',
  visitor_phone: '1144556677',
  visitor_email: null,
  responses: { motivo: 'compra', comentario: 'Hola' },
}

describe('VisitFormResponse entity', () => {
  it('creates with phone only', () => {
    const r = VisitFormResponse.create(base)
    expect(r.visitor_name).toBe('María López')
    expect(r.visitor_phone).toBe('1144556677')
    expect(r.visitor_email).toBeNull()
    expect(r.created_at).toBeDefined()
  })

  it('creates with email only', () => {
    const r = VisitFormResponse.create({
      ...base,
      visitor_phone: null,
      visitor_email: 'maria@example.com',
    })
    expect(r.visitor_email).toBe('maria@example.com')
    expect(r.visitor_phone).toBeNull()
  })

  it('rejects empty visitor_name', () => {
    expect(() => VisitFormResponse.create({ ...base, visitor_name: '' })).toThrow(ValidationError)
  })

  it('rejects whitespace-only visitor_name', () => {
    expect(() => VisitFormResponse.create({ ...base, visitor_name: '   ' })).toThrow(ValidationError)
  })

  it('rejects when both phone and email are null', () => {
    expect(() =>
      VisitFormResponse.create({ ...base, visitor_phone: null, visitor_email: null })
    ).toThrow(ValidationError)
  })

  it('toObject round-trips', () => {
    const r = VisitFormResponse.create(base)
    const obj = r.toObject()
    expect(obj.id).toBe(base.id)
    expect(obj.form_id).toBe(base.form_id)
    expect(obj.visitor_name).toBe(base.visitor_name)
    expect(obj.visitor_phone).toBe(base.visitor_phone)
    expect(obj.visitor_email).toBe(base.visitor_email)
    expect(obj.responses).toEqual(base.responses)
    expect(obj.created_at).toBeDefined()
  })
})
