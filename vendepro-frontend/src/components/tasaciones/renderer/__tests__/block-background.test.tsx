import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TemplateRenderer } from '../TemplateRenderer'
import type { TemplateBlock, AppraisalContext } from '../types'

const appraisal: AppraisalContext = {
  id: 'a1', property_address: 'X', neighborhood: null, city: null, property_type: null,
  covered_area: null, total_area: null, semi_area: null, weighted_area: null,
  swot: null, prices: null, comparables: [], agent: null, org: null,
}

describe('background_color rendering', () => {
  it('paints a solid background on a block without its own style (methodology)', () => {
    const block: TemplateBlock = {
      id: 'b1', type: 'methodology', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
      data: { title: 'T', background_color: '#112233' },
    }
    const { container } = render(<TemplateRenderer snapshot={[block]} appraisal={appraisal} />)
    const wrapper = container.querySelector('[style*="rgb(17, 34, 51)"]')
    expect(wrapper).not.toBeNull()
  })

  it('cover uses a solid background_color instead of the brand gradient when set', () => {
    const block: TemplateBlock = {
      id: 'b2', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
      data: { title: 'T', background_color: '#112233' },
    }
    const { container } = render(<TemplateRenderer snapshot={[block]} appraisal={appraisal} />)
    const section = container.querySelector('section')
    expect(section?.getAttribute('style')).toContain('rgb(17, 34, 51)')
    expect(section?.getAttribute('style')).not.toContain('linear-gradient')
  })

  it('renders no extra wrapper when background_color is absent', () => {
    const block: TemplateBlock = {
      id: 'b3', type: 'methodology', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
      data: { title: 'T' },
    }
    const { container } = render(<TemplateRenderer snapshot={[block]} appraisal={appraisal} />)
    expect(container.querySelector('[style]')).toBeNull()
  })
})
