import { describe, it, expect } from 'vitest'
import { AgentProfile } from '../../src/domain/entities/agent-profile'

const base = { user_id: 'u1', org_id: 'o1', slug: 'andres-giunta' }

describe('AgentProfile', () => {
  it('crea con defaults: no público y colecciones vacías', () => {
    const p = AgentProfile.create(base)
    expect(p.slug).toBe('andres-giunta')
    expect(p.is_public).toBe(false)
    expect(p.zones).toEqual([])
    expect(p.stats).toEqual([])
    expect(p.bio).toBeNull()
  })

  it('valida el slug al crear', () => {
    expect(() => AgentProfile.create({ ...base, slug: 'Andres Giunta' })).toThrow(/slug/i)
  })

  it('update pisa solo lo pasado y refresca updated_at', async () => {
    const p = AgentProfile.create({ ...base, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })
    const p2 = p.update({ bio: 'Vendo casas', zones: ['Saavedra', 'Belgrano'] })
    expect(p2.bio).toBe('Vendo casas')
    expect(p2.zones).toEqual(['Saavedra', 'Belgrano'])
    expect(p2.slug).toBe('andres-giunta')
    expect(p2.updated_at).not.toBe('2026-01-01T00:00:00.000Z')
  })

  it('update valida el slug nuevo', () => {
    const p = AgentProfile.create(base)
    expect(() => p.update({ slug: 'NO VALIDO' })).toThrow(/slug/i)
  })

  it('fromPersistence parsea los *_json', () => {
    const p = AgentProfile.fromPersistence({
      ...base, headline: null, bio: null, license: null, years_experience: null,
      zones_json: '["Saavedra"]', specialties_json: null,
      whatsapp: null, instagram: null, tiktok: null, youtube: null, linkedin: null, website: null,
      cover_image_url: null, stats_json: '[{"label":"TikTok","value":"170.000"}]',
      is_public: 1, created_at: 'x', updated_at: 'y',
    })
    expect(p.zones).toEqual(['Saavedra'])
    expect(p.specialties).toEqual([])
    expect(p.stats).toEqual([{ label: 'TikTok', value: '170.000' }])
    expect(p.is_public).toBe(true)
  })

  it('fromPersistence tolera JSON corrupto y devuelve vacío', () => {
    const p = AgentProfile.fromPersistence({
      ...base, headline: null, bio: null, license: null, years_experience: null,
      zones_json: '{roto', specialties_json: null,
      whatsapp: null, instagram: null, tiktok: null, youtube: null, linkedin: null, website: null,
      cover_image_url: null, stats_json: null,
      is_public: 0, created_at: 'x', updated_at: 'y',
    })
    expect(p.zones).toEqual([])
  })
})
