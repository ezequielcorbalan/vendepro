import { describe, it, expect } from 'vitest'
import { TemplateBlock } from '../../src/domain/entities/template-block'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'tb-1',
  org_id: 'org_mg',
  block_type: 'service' as const,
  title: 'Servicio de Tasación',
  description: 'Realizamos tasaciones profesionales',
  icon: 'home',
  number_label: null,
  video_url: null,
  image_url: null,
  sort_order: 1,
  enabled: 1,
  section: 'commercial' as const,
}

describe('TemplateBlock entity', () => {
  it('creates a valid template block', () => {
    const tb = TemplateBlock.create(baseProps)
    expect(tb.id).toBe('tb-1')
    expect(tb.org_id).toBe('org_mg')
    expect(tb.block_type).toBe('service')
    expect(tb.title).toBe('Servicio de Tasación')
    expect(tb.description).toBe('Realizamos tasaciones profesionales')
    expect(tb.icon).toBe('home')
    expect(tb.sort_order).toBe(1)
    expect(tb.enabled).toBe(1)
    expect(tb.section).toBe('commercial')
    expect(tb.created_at).toBeDefined()
    expect(tb.updated_at).toBeDefined()
  })

  it('accepts each valid block_type', () => {
    for (const type of ['service', 'video', 'stats', 'text', 'custom'] as const) {
      const tb = TemplateBlock.create({ ...baseProps, block_type: type })
      expect(tb.block_type).toBe(type)
    }
  })

  it('accepts each valid section', () => {
    for (const section of ['commercial', 'conditions'] as const) {
      const tb = TemplateBlock.create({ ...baseProps, section })
      expect(tb.section).toBe(section)
    }
  })

  it('throws if title is empty', () => {
    expect(() => TemplateBlock.create({ ...baseProps, title: '' })).toThrow(ValidationError)
  })

  it('throws if title is only whitespace', () => {
    expect(() => TemplateBlock.create({ ...baseProps, title: '   ' })).toThrow(ValidationError)
  })

  it('throws if block_type is invalid', () => {
    expect(() => TemplateBlock.create({ ...baseProps, block_type: 'bogus' as any })).toThrow(ValidationError)
  })

  it('throws if section is invalid', () => {
    expect(() => TemplateBlock.create({ ...baseProps, section: 'nope' as any })).toThrow(ValidationError)
  })

  it('respects created_at / updated_at if provided', () => {
    const created = '2026-01-01T00:00:00.000Z'
    const updated = '2026-02-01T00:00:00.000Z'
    const tb = TemplateBlock.create({ ...baseProps, created_at: created, updated_at: updated })
    expect(tb.created_at).toBe(created)
    expect(tb.updated_at).toBe(updated)
  })

  it('update() applies partial changes and bumps updated_at', async () => {
    const tb = TemplateBlock.create({ ...baseProps, updated_at: '2026-01-01T00:00:00.000Z' })
    const before = tb.updated_at
    await new Promise((r) => setTimeout(r, 2))
    tb.update({ title: 'Nuevo título', enabled: 0 })
    expect(tb.title).toBe('Nuevo título')
    expect(tb.enabled).toBe(0)
    expect(tb.updated_at).not.toBe(before)
  })

  it('toObject round-trips full state', () => {
    const tb = TemplateBlock.create(baseProps)
    const obj = tb.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.block_type).toBe(baseProps.block_type)
    expect(obj.title).toBe(baseProps.title)
    expect(obj.description).toBe(baseProps.description)
    expect(obj.icon).toBe(baseProps.icon)
    expect(obj.number_label).toBe(baseProps.number_label)
    expect(obj.video_url).toBe(baseProps.video_url)
    expect(obj.image_url).toBe(baseProps.image_url)
    expect(obj.sort_order).toBe(baseProps.sort_order)
    expect(obj.enabled).toBe(baseProps.enabled)
    expect(obj.section).toBe(baseProps.section)
    expect(obj.created_at).toBe(tb.created_at)
    expect(obj.updated_at).toBe(tb.updated_at)
  })
})
