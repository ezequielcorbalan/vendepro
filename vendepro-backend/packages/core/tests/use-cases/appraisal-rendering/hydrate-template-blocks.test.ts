import { describe, it, expect, vi } from 'vitest'
import { HydrateTemplateBlocksUseCase } from '../../../src/application/use-cases/appraisal-rendering/hydrate-template-blocks'
import { OrgVariable } from '@vendepro/core'

const snapshot = [
  { id: 'b1', type: 'market_stats', binding_mode: 'org-variable', include_in_pdf: true, sort_order: 0,
    data: { title: 'Mercado', vars: ['market.properties_on_sale'] } },
  { id: 'b2', type: 'work_conditions', binding_mode: 'default-override', include_in_pdf: true, sort_order: 1,
    data: { title: 'Condiciones', honorarios_pct: 3, exclusividad_dias: 120 } },
  { id: 'b3', type: 'video_gallery', binding_mode: 'tasacion', include_in_pdf: false, sort_order: 2,
    data: { title: 'Videos', videos: [] } },
]

describe('HydrateTemplateBlocksUseCase', () => {
  it('resolves org-variable references and applies overrides', async () => {
    const varsRepo = { resolveKeys: vi.fn().mockResolvedValue({
      'market.properties_on_sale': OrgVariable.create({ id: 'v1', org_id: 'o1', key: 'market.properties_on_sale', value: '111294', value_type: 'number', label: null, namespace: 'market', is_system: true }),
    }), findById: vi.fn(), findByKey: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() }
    const uc = new HydrateTemplateBlocksUseCase(varsRepo as any)
    const res = await uc.execute({
      orgId: 'o1', snapshot: snapshot as any,
      overrides: { b2: { honorarios_pct: 2 } },
      appraisal: { swot: { strengths: 'X' } } as any,
    })
    const mkt = res.blocks.find(b => b.id === 'b1')!
    expect((mkt.resolved_data as any).vars_resolved['market.properties_on_sale'].value).toBe('111294')
    const wc = res.blocks.find(b => b.id === 'b2')!
    expect((wc.resolved_data as any).honorarios_pct).toBe(2)
  })

  it('filters blocks for print mode', async () => {
    const varsRepo = { resolveKeys: vi.fn().mockResolvedValue({}), findById: vi.fn(), findByKey: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() }
    const uc = new HydrateTemplateBlocksUseCase(varsRepo as any)
    const res = await uc.execute({ orgId: 'o1', snapshot: snapshot as any, overrides: {}, appraisal: {} as any, mode: 'print' })
    expect(res.blocks.map(b => b.id)).toEqual(['b1', 'b2'])
  })
})
