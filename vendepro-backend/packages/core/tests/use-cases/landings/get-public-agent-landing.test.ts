import { describe, it, expect, vi } from 'vitest'
import { GetPublicAgentLandingUseCase } from '../../../src/application/use-cases/landings/get-public-agent-landing'
import { AgentProfile } from '../../../src/domain/entities/agent-profile'
import { Landing } from '../../../src/domain/entities/landing'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const heroBindeado = (): Block => ({
  id: 'b1', type: 'agent-hero', visible: true, binding: 'agent_profile',
  data: { name: 'X', headline: 'X', bio: 'X', photo_url: 'https://cdn/ph.jpg', ctas: [], accent_color: 'pink' },
} as Block)

function makeDeps() {
  const org = { id: 'o1', name: 'Marcela Genta', slug: 'marcela-genta', logo_url: 'https://cdn/logo.png', brand_color: '#ff007c', brand_accent_color: '#ff8017' }
  const profile = AgentProfile.create({
    user_id: 'u1', org_id: 'o1', slug: 'andres-giunta',
    headline: 'Coordinador Comercial', bio: 'Vendo en Caballito', is_public: true,
  })
  const user = { id: 'u1', org_id: 'o1', full_name: 'Andrés Giunta', photo_url: 'https://cdn/a.jpg', phone: '+5491100000000', active: true, deleted_at: null }
  const landing = Landing.create({
    id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1',
    kind: 'agent_profile', slug_base: 'andres', slug_suffix: 'k7xm3',
    blocks: [heroBindeado()], seo_title: 'Andrés Giunta',
  })

  return {
    org, profile, user, landing,
    orgs: { findBySlug: vi.fn(async () => org) },
    agentProfiles: { findByOrgAndSlug: vi.fn(async () => profile) },
    users: { findProfileById: vi.fn(async () => user) },
    landings: { findPublishedByAgentAndKind: vi.fn(async () => landing) },
  }
}

const build = (d: ReturnType<typeof makeDeps>) =>
  new GetPublicAgentLandingUseCase(d.orgs as any, d.agentProfiles as any, d.users as any, d.landings as any)

describe('GetPublicAgentLandingUseCase', () => {
  it('devuelve los bloques con el binding ya resuelto', async () => {
    const d = makeDeps()
    const out = await build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })
    expect((out.blocks[0].data as any).name).toBe('Andrés Giunta')
    expect((out.blocks[0].data as any).headline).toBe('Coordinador Comercial')
    expect(out.org.brand_color).toBe('#ff007c')
    expect(out.full_slug).toBe('andres-k7xm3')
    expect(out.landing_id).toBe('l1')
  })

  it('404 si la org no existe', async () => {
    const d = makeDeps()
    d.orgs.findBySlug = vi.fn(async () => null) as any
    await expect(build(d).execute({ orgSlug: 'nope', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })

  it('404 si el perfil no es público', async () => {
    const d = makeDeps()
    const privado = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta', is_public: false })
    d.agentProfiles.findByOrgAndSlug = vi.fn(async () => privado) as any
    await expect(build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })

  it('404 si el usuario está inactivo o borrado', async () => {
    const d = makeDeps()
    d.users.findProfileById = vi.fn(async () => ({ ...d.user, active: false })) as any
    await expect(build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()

    const d2 = makeDeps()
    d2.users.findProfileById = vi.fn(async () => ({ ...d2.user, deleted_at: '2026-01-01' })) as any
    await expect(build(d2).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })

  it('404 si el usuario pertenece a otra org', async () => {
    const d = makeDeps()
    d.users.findProfileById = vi.fn(async () => ({ ...d.user, org_id: 'otra' })) as any
    await expect(build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })

  it('404 si no hay landing publicada', async () => {
    const d = makeDeps()
    d.landings.findPublishedByAgentAndKind = vi.fn(async () => null) as any
    await expect(build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })
})
