import { describe, it, expect } from 'vitest'
import { Report } from '../../src/domain/entities/report'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'rpt-1',
  property_id: 'prop-1',
  period_label: 'Octubre 2026',
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  status: 'draft' as const,
  created_by: 'user-1',
  published_at: null,
}

describe('Report entity', () => {
  it('creates a valid report', () => {
    const r = Report.create(baseProps)
    expect(r.id).toBe('rpt-1')
    expect(r.property_id).toBe('prop-1')
    expect(r.period_label).toBe('Octubre 2026')
    expect(r.period_start).toBe('2026-10-01')
    expect(r.period_end).toBe('2026-10-31')
    expect(r.status).toBe('draft')
    expect(r.created_by).toBe('user-1')
    expect(r.published_at).toBeNull()
    expect(r.created_at).toBeDefined()
  })

  it('throws if period_label is empty', () => {
    expect(() => Report.create({ ...baseProps, period_label: '' })).toThrow(ValidationError)
  })

  it('throws if period_label is only whitespace', () => {
    expect(() => Report.create({ ...baseProps, period_label: '   ' })).toThrow(ValidationError)
  })

  it('throws if period_start is empty', () => {
    expect(() => Report.create({ ...baseProps, period_start: '' })).toThrow(ValidationError)
  })

  it('throws if period_end is empty', () => {
    expect(() => Report.create({ ...baseProps, period_end: '' })).toThrow(ValidationError)
  })

  it('respects created_at if provided', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const r = Report.create({ ...baseProps, created_at: fixed })
    expect(r.created_at).toBe(fixed)
  })

  it('auto-generates created_at if not provided', () => {
    const r = Report.create(baseProps)
    expect(() => new Date(r.created_at).toISOString()).not.toThrow()
  })

  it('publish() sets status to published and sets published_at', () => {
    const r = Report.create(baseProps)
    expect(r.status).toBe('draft')
    expect(r.published_at).toBeNull()
    r.publish()
    expect(r.status).toBe('published')
    expect(r.published_at).not.toBeNull()
    expect(() => new Date(r.published_at as string).toISOString()).not.toThrow()
  })

  it('exposes optional joined collections through getters', () => {
    const r = Report.create({
      ...baseProps,
      metrics: [],
      content: [],
      photos: [],
      creator_name: 'Agent One',
      property_address: 'Av. X 123',
    })
    expect(r.metrics).toEqual([])
    expect(r.content).toEqual([])
    expect(r.photos).toEqual([])
    expect(r.creator_name).toBe('Agent One')
    expect(r.property_address).toBe('Av. X 123')
  })

  it('toObject round-trips full state', () => {
    const r = Report.create(baseProps)
    const obj = r.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.property_id).toBe(baseProps.property_id)
    expect(obj.period_label).toBe(baseProps.period_label)
    expect(obj.period_start).toBe(baseProps.period_start)
    expect(obj.period_end).toBe(baseProps.period_end)
    expect(obj.status).toBe(baseProps.status)
    expect(obj.created_by).toBe(baseProps.created_by)
    expect(obj.published_at).toBe(baseProps.published_at)
    expect(obj.created_at).toBe(r.created_at)
  })
})
