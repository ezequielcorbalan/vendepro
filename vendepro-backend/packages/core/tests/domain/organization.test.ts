import { describe, it, expect } from 'vitest'
import { Organization } from '../../src/domain/entities/organization'

const baseProps = {
  id: 'org_mg',
  name: 'Marcela Genta Operaciones',
  slug: 'marcela-genta',
  logo_url: 'https://example.com/logo.png',
  brand_color: '#ff007c',
  brand_accent_color: '#ff8017',
  canva_template_id: null,
  canva_report_template_id: null,
  owner_id: 'user-owner-1',
}

describe('Organization entity', () => {
  it('creates a valid organization', () => {
    const o = Organization.create(baseProps)
    expect(o.id).toBe('org_mg')
    expect(o.name).toBe('Marcela Genta Operaciones')
    expect(o.slug).toBe('marcela-genta')
    expect(o.logo_url).toBe('https://example.com/logo.png')
    expect(o.brand_color).toBe('#ff007c')
    expect(o.brand_accent_color).toBe('#ff8017')
    expect(o.owner_id).toBe('user-owner-1')
    expect(o.created_at).toBeDefined()
  })

  it('creates an organization with minimal/null fields', () => {
    const o = Organization.create({
      ...baseProps,
      logo_url: null,
      brand_accent_color: null,
      canva_template_id: null,
      canva_report_template_id: null,
      owner_id: null,
    })
    expect(o.logo_url).toBeNull()
    expect(o.brand_accent_color).toBeNull()
    expect(o.canva_template_id).toBeNull()
    expect(o.canva_report_template_id).toBeNull()
    expect(o.owner_id).toBeNull()
  })

  it('respects created_at if provided', () => {
    const fixed = '2026-01-01T00:00:00.000Z'
    const o = Organization.create({ ...baseProps, created_at: fixed })
    expect(o.created_at).toBe(fixed)
  })

  it('auto-generates created_at if not provided', () => {
    const o = Organization.create(baseProps)
    expect(() => new Date(o.created_at).toISOString()).not.toThrow()
  })

  it('exposes canva template IDs through getters', () => {
    const o = Organization.create({
      ...baseProps,
      canva_template_id: 'canva-tpl-1',
      canva_report_template_id: 'canva-rpt-1',
    })
    expect(o.canva_template_id).toBe('canva-tpl-1')
    expect(o.canva_report_template_id).toBe('canva-rpt-1')
  })

  it('toObject round-trips full state', () => {
    const o = Organization.create(baseProps)
    const obj = o.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.name).toBe(baseProps.name)
    expect(obj.slug).toBe(baseProps.slug)
    expect(obj.logo_url).toBe(baseProps.logo_url)
    expect(obj.brand_color).toBe(baseProps.brand_color)
    expect(obj.brand_accent_color).toBe(baseProps.brand_accent_color)
    expect(obj.canva_template_id).toBe(baseProps.canva_template_id)
    expect(obj.canva_report_template_id).toBe(baseProps.canva_report_template_id)
    expect(obj.owner_id).toBe(baseProps.owner_id)
    expect(obj.created_at).toBe(o.created_at)
  })
})
