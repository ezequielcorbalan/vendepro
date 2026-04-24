import { describe, it, expect } from 'vitest'
import { validateAppraisalBlocks } from '../../src/domain/value-objects/appraisal-block-schemas'

describe('validateAppraisalBlocks', () => {
  it('accepts empty array', () => {
    const r = validateAppraisalBlocks([])
    expect(r.success).toBe(true)
  })

  it('validates cover block shape', () => {
    const r = validateAppraisalBlocks([{
      id: 'b1',
      type: 'cover',
      binding_mode: 'tasacion',
      include_in_pdf: true,
      sort_order: 0,
      data: { title: 'Tasación', cover_image_url: 'https://x/y.jpg', agent_display: { name: 'N' } },
    }])
    expect(r.success).toBe(true)
  })

  it('rejects unknown type', () => {
    const r = validateAppraisalBlocks([{
      id: 'b1', type: 'nope', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: {},
    }])
    expect(r.success).toBe(false)
  })

  it('forces include_in_pdf=false on web-only types', () => {
    const r = validateAppraisalBlocks([{
      id: 'b1', type: 'video_gallery', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
      data: { title: 'Videos', videos: [{ url: 'https://y', caption: 'x', provider: 'youtube' }] },
    }])
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/web-only/i)
  })
})
