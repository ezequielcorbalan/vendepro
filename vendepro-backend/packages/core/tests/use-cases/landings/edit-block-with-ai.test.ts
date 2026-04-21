import { describe, it, expect, vi } from 'vitest'
import { EditBlockWithAIUseCase } from '../../../src/application/use-cases/landings/edit-block-with-ai'
import { Landing } from '../../../src/domain/entities/landing'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const blocks: Block[] = [
  { id: 'b_hero', type: 'hero', visible: true, data: { title: 'old', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_form', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'Enviar', success_message: 'ok' } },
]

function setup(overrides?: Partial<{ aiEditBlock: any; aiEditGlobal: any }>) {
  const landing = Landing.create({
    id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1',
    kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks, brand_voice: 'cálido',
  })
  const landings = {
    findById: vi.fn(async () => landing),
    save: vi.fn(), findByFullSlug: vi.fn(), findByOrg: vi.fn(), existsFullSlug: vi.fn(),
  }
  const ai = {
    extractLeadIntent: vi.fn(), transcribeAudio: vi.fn(), extractMetricsFromScreenshot: vi.fn(),
    editLandingBlock: overrides?.aiEditBlock ?? vi.fn(async () => ({ status: 'ok', data: { title: 'nuevo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } })),
    editLandingGlobal: overrides?.aiEditGlobal ?? vi.fn(),
  }
  return { landings, ai, landing }
}

describe('EditBlockWithAIUseCase', () => {
  it('scope=block retorna propuesta con data nueva', async () => {
    const d = setup()
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: 'hazlo más cálido', scope: 'block', blockId: 'b_hero' })
    expect(r.status).toBe('ok')
    if (r.status === 'ok' && r.proposal.kind === 'block') {
      expect(r.proposal.blockId).toBe('b_hero')
      expect((r.proposal.data as any).title).toBe('nuevo')
    }
  })

  it('scope=block requiere blockId', async () => {
    const d = setup()
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: 'x', scope: 'block' } as any))
      .rejects.toThrow(/blockId/i)
  })

  it('propaga error_schema si AI falla validación', async () => {
    const d = setup({ aiEditBlock: vi.fn(async () => ({ status: 'error', reason: 'schema_mismatch' })) })
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: 'x', scope: 'block', blockId: 'b_hero' })
    expect(r.status).toBe('error')
    if (r.status === 'error') expect(r.reason).toBe('schema_mismatch')
  })

  it('scope=global retorna array completo', async () => {
    const d = setup({ aiEditGlobal: vi.fn(async () => ({ status: 'ok', blocks: blocks.map(b => b.id === 'b_hero' ? { ...b, data: { ...b.data, title: 'G' } } : b) })) })
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: 'x', scope: 'global' })
    expect(r.status).toBe('ok')
    if (r.status === 'ok' && r.proposal.kind === 'global') {
      expect(r.proposal.blocks.length).toBe(2)
    }
  })

  it('rechaza edits si no tiene permisos', async () => {
    const d = setup()
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u2' }, orgId: 'o1', landingId: 'l1', prompt: 'x', scope: 'block', blockId: 'b_hero' }))
      .rejects.toThrow(/permisos/i)
  })

  it('acota prompt a 500 chars', async () => {
    const d = setup()
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    const longPrompt = 'x'.repeat(600)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: longPrompt, scope: 'block', blockId: 'b_hero' }))
      .rejects.toThrow(/500/i)
  })
})
