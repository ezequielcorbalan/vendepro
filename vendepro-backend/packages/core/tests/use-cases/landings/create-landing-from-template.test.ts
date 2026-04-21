import { describe, it, expect, vi } from 'vitest'
import { CreateLandingFromTemplateUseCase } from '../../../src/application/use-cases/landings/create-landing-from-template'
import { LandingTemplate } from '../../../src/domain/entities/landing-template'
import { Landing } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const makeBlocks = (): Block[] => ([
  { id: 'b_hero', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_form', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'Enviar', success_message: 'ok' } },
])

function makeDeps() {
  const templateStore = new Map<string, LandingTemplate>()
  const landingStore = new Map<string, Landing>()
  const versionStore: LandingVersion[] = []
  const existsSlugs = new Set<string>()

  const templates = {
    findById: vi.fn(async (id: string) => templateStore.get(id) ?? null),
    listVisibleTo: vi.fn(),
    save: vi.fn(),
  }
  const landings = {
    findById: vi.fn(async (id: string) => landingStore.get(id) ?? null),
    findByFullSlug: vi.fn(),
    findByOrg: vi.fn(),
    save: vi.fn(async (l: Landing) => { landingStore.set(l.id, l) }),
    existsFullSlug: vi.fn(async (fs: string) => existsSlugs.has(fs)),
  }
  const versions = {
    findById: vi.fn(),
    listByLanding: vi.fn(),
    save: vi.fn(async (v: LandingVersion) => { versionStore.push(v) }),
    nextVersionNumber: vi.fn(async () => versionStore.length + 1),
    pruneNonPublish: vi.fn(),
  }
  let counter = 0
  const idGen = { generate: vi.fn(() => `id_${++counter}`) }

  return { templates, landings, versions, idGen, templateStore, landingStore, versionStore, existsSlugs }
}

describe('CreateLandingFromTemplateUseCase', () => {
  it('crea landing en draft con copy de bloques del template y versión inicial', async () => {
    const d = makeDeps()
    d.templateStore.set('tpl_1', LandingTemplate.create({
      id: 'tpl_1', org_id: null, name: 'XX', kind: 'property',
      description: null, preview_image_url: null, blocks: makeBlocks(), active: true, sort_order: 1,
    }))

    const uc = new CreateLandingFromTemplateUseCase(d.templates as any, d.landings as any, d.versions as any, d.idGen as any)
    const result = await uc.execute({
      actor: { role: 'agent', userId: 'u1' },
      orgId: 'o1',
      templateId: 'tpl_1',
      slugBase: 'palermo-soho',
      brandVoice: 'cálido',
    })

    expect(result.landingId).toBeDefined()
    expect(result.fullSlug).toMatch(/^palermo-soho-[a-z0-9]{5}$/)
    expect(d.landings.save).toHaveBeenCalledOnce()
    const saved = d.landingStore.get(result.landingId)!
    expect(saved.status).toBe('draft')
    expect(saved.kind).toBe('property')
    expect(saved.blocks.length).toBe(2)
    expect(saved.brand_voice).toBe('cálido')
    expect(d.versionStore.length).toBe(1)
    expect(d.versionStore[0].label).toBe('manual-save')
  })

  it('reintenta si full_slug existe (collisión del suffix)', async () => {
    const d = makeDeps()
    d.templateStore.set('tpl_1', LandingTemplate.create({
      id: 'tpl_1', org_id: null, name: 'XX', kind: 'lead_capture',
      description: null, preview_image_url: null, blocks: makeBlocks(), active: true, sort_order: 1,
    }))
    let calls = 0
    d.landings.existsFullSlug = vi.fn(async () => (++calls === 1))
    const uc = new CreateLandingFromTemplateUseCase(d.templates as any, d.landings as any, d.versions as any, d.idGen as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', templateId: 'tpl_1', slugBase: 'promo' })
    expect(r.landingId).toBeDefined()
    expect(d.landings.existsFullSlug).toHaveBeenCalledTimes(2)
  })

  it('lanza si template no existe', async () => {
    const d = makeDeps()
    const uc = new CreateLandingFromTemplateUseCase(d.templates as any, d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({
      actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', templateId: 'tpl_ghost', slugBase: 'x',
    })).rejects.toThrow(/template/i)
  })

  it('respeta visibilidad multi-tenant: rechaza template de otra org', async () => {
    const d = makeDeps()
    d.templateStore.set('tpl_2', LandingTemplate.create({
      id: 'tpl_2', org_id: 'OTHER_ORG', name: 'priv-template', kind: 'property',
      description: null, preview_image_url: null, blocks: makeBlocks(), active: true, sort_order: 1,
    }))
    const uc = new CreateLandingFromTemplateUseCase(d.templates as any, d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({
      actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', templateId: 'tpl_2', slugBase: 'x',
    })).rejects.toThrow(/template/i)
  })
})
