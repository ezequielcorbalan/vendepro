import { describe, it, expect, vi } from 'vitest'
import { UpdateLandingBlocksUseCase } from '../../../src/application/use-cases/landings/update-landing-blocks'
import { Landing } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const baseBlocks: Block[] = [
  { id: 'b_hero', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_form', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'Enviar', success_message: 'ok' } },
]

function setup() {
  const landing = Landing.create({
    id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1',
    kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks: baseBlocks,
  })
  const store = new Map<string, Landing>([['l1', landing]])
  const versionStore: LandingVersion[] = []
  const landings = {
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    save: vi.fn(async (l: Landing) => { store.set(l.id, l) }),
    findByFullSlug: vi.fn(), findByOrg: vi.fn(), existsFullSlug: vi.fn(),
  }
  const versions = {
    save: vi.fn(async (v: LandingVersion) => { versionStore.push(v) }),
    nextVersionNumber: vi.fn(async () => versionStore.length + 1),
    pruneNonPublish: vi.fn(async () => 0),
    findById: vi.fn(), listByLanding: vi.fn(),
  }
  const idGen = { generate: vi.fn(() => `v_${Math.random().toString(36).slice(2)}`) }
  return { landings, versions, idGen, store, versionStore }
}

describe('UpdateLandingBlocksUseCase', () => {
  it('owner puede actualizar', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    const newBlocks = baseBlocks.map(b => b.id === 'b_hero' ? { ...b, data: { ...b.data, title: 'nuevo' } } : b) as Block[]
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', blocks: newBlocks })
    expect(r.versionNumber).toBe(1)
    expect(d.versionStore[0].label).toBe('manual-save')
    expect(d.versions.pruneNonPublish).toHaveBeenCalled()
  })

  it('rechaza si agente no es owner', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u2' }, orgId: 'o1', landingId: 'l1', blocks: baseBlocks }))
      .rejects.toThrow(/permisos/i)
  })

  it('rechaza blocks sin lead-form', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    const onlyHero = [baseBlocks[0]]
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', blocks: onlyHero }))
      .rejects.toThrow(/lead-form/i)
  })

  it('admin puede editar landing ajena', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'l1', blocks: baseBlocks }))
      .resolves.toBeDefined()
  })

  it('rechaza si landing no existe', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'xxx', blocks: baseBlocks }))
      .rejects.toThrow(/no encontrada|Landing/i)
  })
})
