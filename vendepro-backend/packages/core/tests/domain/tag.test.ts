import { describe, it, expect } from 'vitest'
import { Tag } from '../../src/domain/entities/tag'

const baseProps = {
  id: 'tag-1',
  org_id: 'org_mg',
  name: 'Urgente',
  color: '#ff007c',
  is_default: 0,
}

describe('Tag entity', () => {
  it('creates a valid tag', () => {
    const t = Tag.create(baseProps)
    expect(t.id).toBe('tag-1')
    expect(t.org_id).toBe('org_mg')
    expect(t.name).toBe('Urgente')
    expect(t.color).toBe('#ff007c')
    expect(t.is_default).toBe(0)
    expect(t.created_at).toBeDefined()
  })

  it('creates a default tag (is_default=1)', () => {
    const t = Tag.create({ ...baseProps, is_default: 1 })
    expect(t.is_default).toBe(1)
  })

  it('respects created_at if provided', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const t = Tag.create({ ...baseProps, created_at: fixed })
    expect(t.created_at).toBe(fixed)
  })

  it('auto-generates created_at if not provided', () => {
    const t = Tag.create(baseProps)
    expect(() => new Date(t.created_at).toISOString()).not.toThrow()
  })

  it('toObject round-trips full state', () => {
    const t = Tag.create(baseProps)
    const obj = t.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.name).toBe(baseProps.name)
    expect(obj.color).toBe(baseProps.color)
    expect(obj.is_default).toBe(baseProps.is_default)
    expect(obj.created_at).toBe(t.created_at)
  })
})
