import { describe, it, expect } from 'vitest'
import { LeadProperty, LEAD_PROPERTY_STATUSES } from '../../src/domain/entities/lead-property'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'lp-1',
  org_id: 'org_mg',
  lead_id: 'lead-1',
  property_id: 'prop-1',
  notes: null,
  feedback: null,
}

describe('LeadProperty entity', () => {
  it('creates with default status interesado', () => {
    const lp = LeadProperty.create(baseProps)
    expect(lp.status).toBe('interesado')
    expect(lp.created_at).toBeDefined()
    expect(lp.updated_at).toBeDefined()
  })

  it('accepts every valid status', () => {
    for (const status of LEAD_PROPERTY_STATUSES) {
      expect(LeadProperty.create({ ...baseProps, status }).status).toBe(status)
    }
  })

  it('rejects an invalid status', () => {
    expect(() => LeadProperty.create({ ...baseProps, status: 'comprada' as any })).toThrow(ValidationError)
  })

  it('requires org_id, lead_id and property_id', () => {
    expect(() => LeadProperty.create({ ...baseProps, org_id: '' })).toThrow(ValidationError)
    expect(() => LeadProperty.create({ ...baseProps, lead_id: '' })).toThrow(ValidationError)
    expect(() => LeadProperty.create({ ...baseProps, property_id: '' })).toThrow(ValidationError)
  })

  it('updateStatus changes status and optionally feedback', () => {
    const lp = LeadProperty.create(baseProps)
    lp.updateStatus('visitada', 'Le gustó la luz, precio alto')
    expect(lp.status).toBe('visitada')
    expect(lp.feedback).toBe('Le gustó la luz, precio alto')
  })

  it('updateStatus without feedback keeps the previous one', () => {
    const lp = LeadProperty.create({ ...baseProps, feedback: 'previo' })
    lp.updateStatus('descartada')
    expect(lp.feedback).toBe('previo')
  })

  it('updateStatus rejects invalid status', () => {
    const lp = LeadProperty.create(baseProps)
    expect(() => lp.updateStatus('vendida' as any)).toThrow(ValidationError)
  })

  it('status is a free label: any valid status can follow any other', () => {
    const lp = LeadProperty.create({ ...baseProps, status: 'oferto' })
    lp.updateStatus('interesado')
    expect(lp.status).toBe('interesado')
  })

  it('toObject returns a copy', () => {
    const lp = LeadProperty.create(baseProps)
    const obj = lp.toObject()
    expect(obj.id).toBe('lp-1')
    ;(obj as any).status = 'oferto'
    expect(lp.status).toBe('interesado')
  })
})
