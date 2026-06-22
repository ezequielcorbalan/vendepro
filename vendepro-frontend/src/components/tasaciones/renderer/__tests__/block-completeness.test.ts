import { describe, it, expect } from 'vitest'
import { getBlockCompleteness } from '../block-completeness'
import type { AppraisalContext, TemplateBlock } from '../types'

const fullAppraisal: AppraisalContext = {
  id: 'a1', property_address: 'X', neighborhood: 'Y', city: 'C', property_type: 'casa',
  covered_area: 100, total_area: 120, semi_area: 10, weighted_area: 110,
  swot: { strengths: 's', weaknesses: 'w', opportunities: 'o', threats: 't' },
  prices: { suggested: 300000, test: 320000, expected_close: 280000, usd_per_m2: 3000 },
  comparables: [{ id: 'c1', appraisal_id: 'a1', kind: 'publicacion', zonaprop_url: null, address: 'Z', total_area: 100, covered_area: 80, price: 300000, usd_per_m2: 3000, days_on_market: null, views_per_day: null, age: null, closing_price_usd: null, closed_at: null, source_sold_property_id: null, sort_order: 0 }],
  agent: null, org: null,
}

const emptyAppraisal: AppraisalContext = {
  ...fullAppraisal,
  covered_area: null, total_area: null, semi_area: null, weighted_area: null,
  swot: { strengths: null, weaknesses: null, opportunities: null, threats: null },
  prices: { suggested: null, test: null, expected_close: null, usd_per_m2: null },
  comparables: [],
}

function block(type: TemplateBlock['type'], data: Record<string, unknown> = {}): Pick<TemplateBlock, 'type' | 'data'> {
  return { type, data }
}

describe('getBlockCompleteness', () => {
  it('considers static/org blocks always complete', () => {
    for (const t of ['cover', 'proposal_commercial', 'services_grid', 'methodology', 'work_conditions', 'market_stats'] as const) {
      expect(getBlockCompleteness(block(t), emptyAppraisal).complete).toBe(true)
    }
  })

  it('property_data: complete with m², incomplete without', () => {
    expect(getBlockCompleteness(block('property_data'), fullAppraisal).complete).toBe(true)
    const r = getBlockCompleteness(block('property_data'), emptyAppraisal)
    expect(r.complete).toBe(false)
    expect(r.missingLabel).toMatch(/metros/i)
  })

  it('property_data: complete with only total_area', () => {
    const a = { ...emptyAppraisal, total_area: 90 }
    expect(getBlockCompleteness(block('property_data'), a).complete).toBe(true)
  })

  it('swot: incomplete when all four fields empty, complete with any', () => {
    expect(getBlockCompleteness(block('swot'), emptyAppraisal).complete).toBe(false)
    const a = { ...emptyAppraisal, swot: { strengths: 'algo', weaknesses: null, opportunities: null, threats: null } }
    expect(getBlockCompleteness(block('swot'), a).complete).toBe(true)
  })

  it('price_projection: incomplete with no prices, complete with suggested', () => {
    expect(getBlockCompleteness(block('price_projection'), emptyAppraisal).complete).toBe(false)
    const a = { ...emptyAppraisal, prices: { suggested: 100000, test: null, expected_close: null, usd_per_m2: null } }
    expect(getBlockCompleteness(block('price_projection'), a).complete).toBe(true)
  })

  it('comparables_list published: needs a publicacion comparable', () => {
    expect(getBlockCompleteness(block('comparables_list', { variant: 'published' }), emptyAppraisal).complete).toBe(false)
    expect(getBlockCompleteness(block('comparables_list', { variant: 'published' }), fullAppraisal).complete).toBe(true)
  })

  it('comparables_list reserved: needs a venta comparable (publicacion does not count)', () => {
    expect(getBlockCompleteness(block('comparables_list', { variant: 'reserved' }), fullAppraisal).complete).toBe(false)
    const a = { ...emptyAppraisal, comparables: [{ ...fullAppraisal.comparables[0], kind: 'venta' as const }] }
    expect(getBlockCompleteness(block('comparables_list', { variant: 'reserved' }), a).complete).toBe(true)
  })
})
