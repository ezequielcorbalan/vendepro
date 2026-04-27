import { describe, it, expect } from 'vitest'
import { hydrateBlocks } from '../hydrate-blocks'
import type { TemplateBlock, AppraisalContext } from '../types'

const baseAppraisal: AppraisalContext = {
  id: 'a1',
  property_address: 'Mistral 3224',
  neighborhood: 'Villa Urquiza',
  city: 'CABA',
  property_type: 'casa',
  covered_area: 185,
  total_area: 240,
  semi_area: 20,
  weighted_area: 200,
  swot: { strengths: 'S', weaknesses: 'W', opportunities: 'O', threats: 'T' },
  prices: { suggested: 450000, test: 470000, expected_close: 420000, usd_per_m2: 2432 },
  comparables: [],
  agent: { name: 'Marcela', phone: null, email: null, avatar_url: null },
  org: { name: 'MG', logo_url: null, brand_color: null, brand_accent_color: null },
}

describe('hydrateBlocks', () => {
  it('orders by sort_order asc', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b2', type: 'methodology', binding_mode: 'org-static', include_in_pdf: true, sort_order: 2, data: { body: 'M' } },
      { id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { title: 'Hi' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    expect(out.map(b => b.id)).toEqual(['b1', 'b2'])
  })

  it('filters web-only when mode=print', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: {} },
      { id: 'b2', type: 'cta_whatsapp', binding_mode: 'org-static', include_in_pdf: false, sort_order: 1, data: { text: 'Hola' } },
    ]
    const webOut = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    const printOut = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'print' })
    expect(webOut).toHaveLength(2)
    expect(printOut).toHaveLength(1)
    expect(printOut[0].id).toBe('b1')
  })

  it('resolves appraisal.swot source', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'swot', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { source: 'appraisal.swot', title: 'FODA' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    expect(out[0].resolved_data).toMatchObject({ source: 'appraisal.swot', title: 'FODA', strengths: 'S', threats: 'T' })
  })

  it('resolves appraisal.* source with property fields', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'property_data', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { source: 'appraisal.*' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    expect(out[0].resolved_data).toMatchObject({
      property_address: 'Mistral 3224',
      neighborhood: 'Villa Urquiza',
      covered_area: 185,
    })
  })

  it('resolves vars with vars_resolved map', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'market_stats', binding_mode: 'org-variable', include_in_pdf: true, sort_order: 0, data: { vars: ['market.on_sale', 'market.sold'] } },
    ]
    const resolvedVars = {
      'market.on_sale': { value: '111294', type: 'number' },
      'market.sold': { value: '7646', type: 'number' },
    }
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars, mode: 'web' })
    expect(out[0].resolved_data.vars_resolved).toEqual(resolvedVars)
  })

  it('merges overrides shallow over resolved data', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'work_conditions', binding_mode: 'default-override', include_in_pdf: true, sort_order: 0, data: { honorarios_pct: 3, exclusividad_dias: 120 } },
    ]
    const overrides = { b1: { honorarios_pct: 2.5 } }
    const out = hydrateBlocks({ snapshot, overrides, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    expect(out[0].resolved_data).toMatchObject({ honorarios_pct: 2.5, exclusividad_dias: 120 })
  })

  it('handles null prices source gracefully', () => {
    const appraisal = { ...baseAppraisal, prices: null }
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'price_projection', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { source: 'appraisal.prices' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal, resolvedVars: {}, mode: 'web' })
    expect(out[0].resolved_data).not.toHaveProperty('suggested')
    expect(out[0].resolved_data).not.toHaveProperty('expected_close')
  })

  it('resolves comparables', () => {
    const appraisal = { ...baseAppraisal, comparables: [{ id: 'c1', appraisal_id: 'a1', zonaprop_url: null, address: 'X', total_area: 100, covered_area: 80, price: 300000, usd_per_m2: 3000, days_on_market: null, views_per_day: null, age: null, sort_order: 0 }] }
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'comparables_list', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { source: 'appraisal.comparables', variant: 'published' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal, resolvedVars: {}, mode: 'web' })
    expect((out[0].resolved_data as any).comparables).toHaveLength(1)
  })
})
