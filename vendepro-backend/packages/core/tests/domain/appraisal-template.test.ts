import { describe, it, expect } from 'vitest'
import { AppraisalTemplate } from '../../src/domain/entities/appraisal-template'

const validBlock = {
  id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true,
  sort_order: 0, data: { title: 'T' },
}

describe('AppraisalTemplate', () => {
  it('creates a valid template', () => {
    const t = AppraisalTemplate.create({
      id: 't1', org_id: null, kind: 'casa', name: 'Sistema Casa',
      description: null, preview_image_url: null, blocks: [validBlock] as any,
      is_system: true, parent_template_id: null, active: true, sort_order: 0,
    })
    expect(t.id).toBe('t1'); expect(t.isSystem()).toBe(true); expect(t.isGlobal()).toBe(true)
  })

  it('rejects short name', () => {
    expect(() => AppraisalTemplate.create({
      id: 't1', org_id: 'o1', kind: 'casa', name: 'x', description: null,
      preview_image_url: null, blocks: [], is_system: false,
      parent_template_id: null, active: true, sort_order: 0,
    })).toThrow(/name/)
  })

  it('rejects invalid kind', () => {
    expect(() => AppraisalTemplate.create({
      id: 't1', org_id: 'o1', kind: 'foo' as any, name: 'Nombre', description: null,
      preview_image_url: null, blocks: [], is_system: false,
      parent_template_id: null, active: true, sort_order: 0,
    })).toThrow(/kind/)
  })

  it('duplicate() clones blocks and sets parent', () => {
    const sys = AppraisalTemplate.create({
      id: 'sys1', org_id: null, kind: 'casa', name: 'Sys', description: null,
      preview_image_url: null, blocks: [validBlock] as any, is_system: true,
      parent_template_id: null, active: true, sort_order: 0,
    })
    const copy = sys.duplicateFor('org1', 'new-id', 'My Casa')
    expect(copy.org_id).toBe('org1'); expect(copy.isSystem()).toBe(false)
    expect(copy.parent_template_id).toBe('sys1'); expect(copy.blocks.length).toBe(1)
  })
})
