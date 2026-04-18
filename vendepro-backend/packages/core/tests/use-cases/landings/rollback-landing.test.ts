import { describe, it, expect, vi } from 'vitest'
import { RollbackLandingUseCase } from '../../../src/application/use-cases/landings/rollback-landing'
import { Landing } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const blocks: Block[] = [
  { id: 'b_h', type: 'hero', visible: true, data: { title: 'actual', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: 'ok' } },
]
const oldBlocks: Block[] = [
  { ...blocks[0], data: { ...blocks[0].data, title: 'viejo' } } as Block,
  blocks[1],
]

function setup() {
  const landing = Landing.create({ id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1', kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks })
  const store = new Map<string, Landing>([['l1', landing]])
  const targetVersion = LandingVersion.create({ id: 'v_old', landing_id: 'l1', version_number: 3, blocks: oldBlocks, label: 'manual-save', created_by: 'u1' })
  const verStore: LandingVersion[] = [targetVersion]
  const landings = { findById: vi.fn(async () => store.get('l1') ?? null), save: vi.fn(async (l: Landing) => { store.set(l.id, l) }), findByFullSlug: vi.fn(), findByOrg: vi.fn(), existsFullSlug: vi.fn() }
  const versions = {
    findById: vi.fn(async (id: string) => verStore.find(v => v.id === id) ?? null),
    save: vi.fn(async (v: LandingVersion) => { verStore.push(v) }),
    nextVersionNumber: vi.fn(async () => Math.max(...verStore.map(v => v.version_number)) + 1),
    pruneNonPublish: vi.fn(), listByLanding: vi.fn(),
  }
  let n = 0
  const idGen = { generate: vi.fn(() => `id_${++n}`) }
  return { landings, versions, idGen, store, verStore }
}

describe('RollbackLandingUseCase', () => {
  it('restaura bloques de la versión target y crea nueva versión', async () => {
    const d = setup()
    const uc = new RollbackLandingUseCase(d.landings as any, d.versions as any, d.idGen as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', versionId: 'v_old' })
    expect((d.store.get('l1')!.blocks[0].data as any).title).toBe('viejo')
    expect(r.versionNumber).toBeGreaterThan(3)
    expect(d.verStore.length).toBe(2)
  })

  it('rechaza si la versión pertenece a otra landing', async () => {
    const d = setup()
    d.versions.findById = vi.fn(async () => LandingVersion.create({ id: 'v_x', landing_id: 'OTHER', version_number: 1, blocks: oldBlocks, label: 'manual-save', created_by: 'u1' }))
    const uc = new RollbackLandingUseCase(d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', versionId: 'v_x' }))
      .rejects.toThrow(/Version|no encontrada/i)
  })
})
