import { describe, it, expect, vi } from 'vitest'
import { GetPublicLandingUseCase } from '../../../src/application/use-cases/landings/get-public-landing'
import { Landing, type LandingProps } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import { AgentProfile } from '../../../src/domain/entities/agent-profile'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

function makeLanding(overrides: Partial<LandingProps> = {}): Landing {
  const now = new Date().toISOString()
  return Landing.fromPersistence({
    id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1',
    kind: 'agent_profile', slug_base: 'andres', slug_suffix: 'k7xm3',
    status: 'published', blocks: [],
    brand_voice: null, lead_rules: null,
    seo_title: null, seo_description: null, og_image_url: null,
    published_version_id: 'v1', published_at: now, published_by: 'admin1',
    last_review_note: null, template_type: null,
    created_at: now, updated_at: now,
    ...overrides,
  })
}

const footerBlock = (): Block => ({ id: 'b1', type: 'footer', visible: true, data: {} } as Block)

function makeDeps() {
  const landing = makeLanding()
  const version = LandingVersion.create({
    id: 'v1', landing_id: 'l1', version_number: 1,
    blocks: [footerBlock()], label: 'publish', created_by: 'admin1',
  })
  const profile = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta', is_public: true })
  const org = { id: 'o1', slug: 'marcela-genta' }

  return {
    landings: { findByFullSlug: vi.fn(async () => landing) },
    versions: { findById: vi.fn(async () => version) },
    orgs: { findById: vi.fn(async () => org) },
    agentProfiles: { findByUserId: vi.fn(async () => profile) },
  }
}

const build = (d: ReturnType<typeof makeDeps>) =>
  new GetPublicLandingUseCase(d.landings as any, d.versions as any, d.orgs as any, d.agentProfiles as any)

// Camino feliz de resolveAgentPublicPath: hasta ahora solo estaba cubierto el
// caso trivial (kind !== 'agent_profile' -> null) en el e2e de infrastructure.
// Acá se ejercitan las 4 ramas reales: path construido, perfil no público,
// perfil inexistente, y kind distinto (corta antes de consultar nada).
describe('GetPublicLandingUseCase — agent_public_path', () => {
  it('/a/<orgSlug>/<agentSlug> cuando kind=agent_profile y el perfil es público', async () => {
    const d = makeDeps()
    const out = await build(d).execute({ fullSlug: 'andres-k7xm3' })
    expect(out.agent_public_path).toBe('/a/marcela-genta/andres-giunta')
    expect(out.kind).toBe('agent_profile')
    expect(out.blocks).toHaveLength(1)
  })

  it('null si el perfil del agente no es público', async () => {
    const d = makeDeps()
    d.agentProfiles.findByUserId = vi.fn(async () =>
      AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta', is_public: false }),
    ) as any
    const out = await build(d).execute({ fullSlug: 'andres-k7xm3' })
    expect(out.agent_public_path).toBeNull()
  })

  it('null si el agente no tiene perfil', async () => {
    const d = makeDeps()
    d.agentProfiles.findByUserId = vi.fn(async () => null) as any
    const out = await build(d).execute({ fullSlug: 'andres-k7xm3' })
    expect(out.agent_public_path).toBeNull()
  })

  it('null si kind no es agent_profile — no consulta perfil ni org', async () => {
    const d = makeDeps()
    d.landings.findByFullSlug = vi.fn(async () => makeLanding({ kind: 'property' })) as any
    const out = await build(d).execute({ fullSlug: 'andres-k7xm3' })
    expect(out.agent_public_path).toBeNull()
    expect(d.agentProfiles.findByUserId).not.toHaveBeenCalled()
  })
})
