import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Prefactibilidad } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1PrefactibilidadRepository } from '../../src/repositories/d1-prefactibilidad-repository'

describe('D1PrefactibilidadRepository', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    const user = await seedUser(env.DB, orgId)
    agentId = user.id
  })

  const buildPrefact = (overrides: Partial<Parameters<typeof Prefactibilidad.create>[0]> = {}) =>
    Prefactibilidad.create({
      id: nextId('pref'),
      org_id: orgId,
      agent_id: agentId,
      lead_id: null,
      public_slug: null,
      status: 'draft',
      address: 'Av. Libertador 1000',
      neighborhood: 'Palermo',
      city: 'Buenos Aires',
      lot_area: 500,
      lot_frontage: 20,
      lot_depth: 25,
      zoning: 'R2aI',
      fot: 2.5,
      fos: 0.6,
      max_height: '27m',
      lot_price: 500000,
      lot_price_per_m2: 1000,
      lot_description: 'Lote premium',
      lot_photos: JSON.stringify(['p1.jpg', 'p2.jpg']),
      project_name: 'Torre X',
      project_description: null,
      buildable_area: 1200,
      total_units: 20,
      units_mix: JSON.stringify([{ type: '2amb', count: 10 }, { type: '3amb', count: 10 }]),
      parking_spots: 20,
      amenities: JSON.stringify(['pileta', 'sum']),
      project_renders: JSON.stringify(['r1.jpg']),
      construction_cost_per_m2: 1500,
      total_construction_cost: 1800000,
      professional_fees: 100000,
      permits_cost: 50000,
      commercialization_cost: 80000,
      other_costs: 20000,
      total_investment: 2550000,
      avg_sale_price_per_m2: 3500,
      total_sellable_area: 1100,
      projected_revenue: 3850000,
      gross_margin: 1300000,
      margin_pct: 33.76,
      tir: 18.5,
      payback_months: 30,
      comparables: JSON.stringify([{ address: 'Cmp 1', price: 300000 }]),
      timeline: JSON.stringify([{ phase: 'obra', months: 24 }]),
      executive_summary: 'Proyecto viable',
      recommendation: 'Avanzar',
      video_url: null,
      agent_notes: null,
      ...overrides,
    })

  it('save + findById round-trip preserves core fields and JSON blobs', async () => {
    const repo = new D1PrefactibilidadRepository(env.DB)
    const p = buildPrefact()
    await repo.save(p)

    const found = await repo.findById(p.id, orgId)
    expect(found).not.toBeNull()
    const o = found!.toObject()
    expect(o.id).toBe(p.id)
    expect(o.org_id).toBe(orgId)
    expect(o.agent_id).toBe(agentId)
    expect(o.address).toBe('Av. Libertador 1000')
    expect(o.lot_area).toBe(500)
    expect(o.fot).toBe(2.5)
    expect(o.project_name).toBe('Torre X')
    expect(o.total_units).toBe(20)
    expect(o.margin_pct).toBe(33.76)
    expect(o.executive_summary).toBe('Proyecto viable')
    // JSON TEXT fields preserved verbatim
    expect(JSON.parse(o.units_mix!)).toEqual([
      { type: '2amb', count: 10 },
      { type: '3amb', count: 10 },
    ])
    expect(JSON.parse(o.amenities!)).toEqual(['pileta', 'sum'])
  })

  it('findByOrg returns only rows for the given org', async () => {
    const repo = new D1PrefactibilidadRepository(env.DB)
    await repo.save(buildPrefact())
    await repo.save(buildPrefact({ address: 'Otra dir' }))

    const org2 = await seedOrg(env.DB)
    const user2 = await seedUser(env.DB, org2.id)
    await repo.save(buildPrefact({ org_id: org2.id, agent_id: user2.id }))

    const mine = await repo.findByOrg(orgId)
    expect(mine.length).toBe(2)
    expect(mine.every(r => r.org_id === orgId)).toBe(true)
  })

  it('findPublicBySlug returns row without org scope when slug matches', async () => {
    const repo = new D1PrefactibilidadRepository(env.DB)
    const p = buildPrefact({ public_slug: 'prefact-public-1' })
    await repo.save(p)

    const found = await repo.findPublicBySlug('prefact-public-1')
    expect(found).not.toBeNull()
    expect(found!.id).toBe(p.id)

    const missing = await repo.findPublicBySlug('no-such-slug')
    expect(missing).toBeNull()
  })

  it('delete removes the row', async () => {
    const repo = new D1PrefactibilidadRepository(env.DB)
    const p = buildPrefact()
    await repo.save(p)
    await repo.delete(p.id, orgId)
    expect(await repo.findById(p.id, orgId)).toBeNull()
  })
})
