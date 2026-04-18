import { describe, it, expect, vi } from 'vitest'
import { RequestPublishUseCase } from '../../../src/application/use-cases/landings/request-publish'
import { PublishLandingUseCase } from '../../../src/application/use-cases/landings/publish-landing'
import { RejectPublishRequestUseCase } from '../../../src/application/use-cases/landings/reject-publish-request'
import { Landing } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const blocks: Block[] = [
  { id: 'b_h', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: 'ok' } },
]

function setup(status: 'draft'|'pending_review'|'published'|'archived' = 'draft') {
  const landing = Landing.create({ id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1', kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks })
  const current = status === 'draft' ? landing : landing.transitionStatus(status === 'published' ? 'pending_review' : status)
  const store = new Map<string, Landing>([['l1', status === 'published'
    ? current.markPublished({ version_id: 'v0', published_by: 'adm' })
    : current]])
  const versionStore: LandingVersion[] = []
  const landings = {
    findById: vi.fn(async () => store.get('l1') ?? null),
    save: vi.fn(async (l: Landing) => { store.set(l.id, l) }),
    findByFullSlug: vi.fn(), findByOrg: vi.fn(), existsFullSlug: vi.fn(),
  }
  const versions = {
    save: vi.fn(async (v: LandingVersion) => { versionStore.push(v) }),
    nextVersionNumber: vi.fn(async () => versionStore.length + 1),
    pruneNonPublish: vi.fn(), findById: vi.fn(), listByLanding: vi.fn(),
  }
  let n = 0
  const idGen = { generate: vi.fn(() => `id_${++n}`) }
  return { landings, versions, idGen, store, versionStore }
}

describe('publish flow', () => {
  it('request → pending_review', async () => {
    const d = setup('draft')
    await new RequestPublishUseCase(d.landings as any).execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1' })
    expect(d.store.get('l1')!.status).toBe('pending_review')
  })

  it('publish exige admin', async () => {
    const d = setup('pending_review')
    await expect(new PublishLandingUseCase(d.landings as any, d.versions as any, d.idGen as any)
      .execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1' }))
      .rejects.toThrow(/admin/i)
  })

  it('publish crea version publish y transiciona', async () => {
    const d = setup('pending_review')
    const r = await new PublishLandingUseCase(d.landings as any, d.versions as any, d.idGen as any)
      .execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'l1' })
    expect(d.versionStore[0].label).toBe('publish')
    const saved = d.store.get('l1')!
    expect(saved.status).toBe('published')
    expect(saved.published_version_id).toBe(r.versionId)
    expect(saved.published_by).toBe('adm')
  })

  it('reject vuelve a draft con nota', async () => {
    const d = setup('pending_review')
    await new RejectPublishRequestUseCase(d.landings as any)
      .execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'l1', note: 'falta cambiar título' })
    const saved = d.store.get('l1')!
    expect(saved.status).toBe('draft')
    expect(saved.last_review_note).toBe('falta cambiar título')
  })

  it('reject solo desde pending_review', async () => {
    const d = setup('draft')
    await expect(new RejectPublishRequestUseCase(d.landings as any)
      .execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'l1' }))
      .rejects.toThrow(/pending_review/i)
  })
})
