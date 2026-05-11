import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TemplateRenderer } from '../TemplateRenderer'
import type { TemplateBlock, AppraisalContext } from '../types'
import { APPRAISAL_BLOCK_TYPES } from '../types'

const appraisal: AppraisalContext = {
  id: 'a1', property_address: 'X', neighborhood: 'Y', city: 'C', property_type: 'casa',
  covered_area: 100, total_area: 120, semi_area: 10, weighted_area: 110,
  swot: { strengths: 's', weaknesses: 'w', opportunities: 'o', threats: 't' },
  prices: { suggested: 300000, test: 320000, expected_close: 280000, usd_per_m2: 3000 },
  comparables: [{ id: 'c1', appraisal_id: 'a1', kind: 'publicacion', zonaprop_url: null, address: 'Z', total_area: 100, covered_area: 80, price: 300000, usd_per_m2: 3000, days_on_market: null, views_per_day: null, age: null, closing_price_usd: null, closed_at: null, source_sold_property_id: null, sort_order: 0 }],
  agent: { name: 'M', phone: '+5411', email: 'm@x.com', avatar_url: null },
  org: { name: 'MG', logo_url: null, brand_color: '#ff007c', brand_accent_color: null },
}

describe('blocks smoke tests', () => {
  for (const type of APPRAISAL_BLOCK_TYPES) {
    it(`renders ${type} without crashing`, () => {
      const block: TemplateBlock = {
        id: `b-${type}`, type, binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
        data: { title: 'T', phone: '+5411', videos: [], media: [], services: [{ label: 'S' }], items: [{ title: 'I', body: 'B' }], funnel: [{ label: 'A', value: 1 }] },
      }
      expect(() => render(<TemplateRenderer snapshot={[block]} appraisal={appraisal} />)).not.toThrow()
    })
  }
})
