import { describe, it, expect } from 'vitest'
import { Landing } from '../../src/domain/entities/landing'
import type { Block } from '../../src/domain/value-objects/block-schemas'

const makeHero = (id = 'b_hero'): Block => ({
  id, type: 'hero', visible: true,
  data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 },
})
const makeLeadForm = (id = 'b_form'): Block => ({
  id, type: 'lead-form', visible: true,
  data: {
    title: 'Contact', fields: [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'phone', label: 'Tel', required: true },
    ],
    submit_label: 'Enviar', success_message: 'ok',
  },
})

describe('Landing', () => {
  it('crea con props mínimas válidas', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })
    expect(l.id).toBe('l1')
    expect(l.full_slug).toBe('palermo-k7xm3')
    expect(l.status).toBe('draft')
    expect(l.blocks.length).toBe(2)
  })

  it('rechaza si no hay lead-form', () => {
    expect(() => Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero()],
    })).toThrow(/lead-form/i)
  })

  it('rechaza si hay más de un lead-form', () => {
    expect(() => Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeLeadForm('f1'), makeLeadForm('f2')],
    })).toThrow(/único/i)
  })

  it('rechaza kind inválido', () => {
    expect(() => Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'foobar' as any,
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })).toThrow(/kind/i)
  })

  it('replaceBlocks valida y actualiza', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })
    const next = [makeHero('new'), makeLeadForm()]
    const l2 = l.replaceBlocks(next)
    expect(l2.blocks[0].id).toBe('new')
  })

  it('transitionStatus respeta transiciones válidas', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })
    const l2 = l.transitionStatus('pending_review')
    expect(l2.status).toBe('pending_review')
    expect(() => l.transitionStatus('published')).toThrow()
  })

  it('markPublished setea published_version_id/at/by y status', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    }).transitionStatus('pending_review')
    const l2 = l.markPublished({ version_id: 'v1', published_by: 'admin1', at: '2026-04-18T10:00:00Z' })
    expect(l2.status).toBe('published')
    expect(l2.published_version_id).toBe('v1')
    expect(l2.published_by).toBe('admin1')
    expect(l2.published_at).toBe('2026-04-18T10:00:00Z')
  })
})
