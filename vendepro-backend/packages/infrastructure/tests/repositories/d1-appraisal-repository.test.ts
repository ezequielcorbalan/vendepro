import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Appraisal } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1AppraisalRepository } from '../../src/repositories/d1-appraisal-repository'

describe('D1AppraisalRepository', () => {
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

  const buildAppraisal = (overrides: Partial<Parameters<typeof Appraisal.create>[0]> = {}) =>
    Appraisal.create({
      id: nextId('app'),
      org_id: orgId,
      property_address: 'Av. Siempre Viva 123',
      neighborhood: 'Palermo',
      city: 'Buenos Aires',
      property_type: 'departamento',
      covered_area: 80,
      total_area: 90,
      semi_area: 10,
      weighted_area: 85,
      strengths: 'luz',
      weaknesses: 'ruido',
      opportunities: 'subte',
      threats: 'otros',
      publication_analysis: null,
      suggested_price: 200000,
      test_price: null,
      expected_close_price: 190000,
      usd_per_m2: 2500,
      canva_design_id: null,
      canva_edit_url: null,
      agent_id: agentId,
      lead_id: null,
      status: 'draft',
      public_slug: null,
      ...overrides,
    })

  it('save + findById round-trip persists every field', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const app = buildAppraisal({ public_slug: 'slug-xyz', suggested_price: 250000 })
    await repo.save(app)

    const found = await repo.findById(app.id, orgId)
    expect(found).not.toBeNull()
    const o = found!.toObject()
    expect(o.id).toBe(app.id)
    expect(o.org_id).toBe(orgId)
    expect(o.property_address).toBe('Av. Siempre Viva 123')
    expect(o.neighborhood).toBe('Palermo')
    expect(o.city).toBe('Buenos Aires')
    expect(o.property_type).toBe('departamento')
    expect(o.covered_area).toBe(80)
    expect(o.total_area).toBe(90)
    expect(o.suggested_price).toBe(250000)
    expect(o.expected_close_price).toBe(190000)
    expect(o.agent_id).toBe(agentId)
    expect(o.status).toBe('draft')
    expect(o.public_slug).toBe('slug-xyz')
  })

  it('findBySlug returns the appraisal without org scope (public)', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const app = buildAppraisal({ public_slug: 'public-123' })
    await repo.save(app)

    const found = await repo.findBySlug('public-123')
    expect(found).not.toBeNull()
    expect(found!.id).toBe(app.id)

    const missing = await repo.findBySlug('nope')
    expect(missing).toBeNull()
  })

  it('findByOrg scopes by organization and applies filters', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const a1 = buildAppraisal({ status: 'draft' })
    const a2 = buildAppraisal({ status: 'generated' })
    await repo.save(a1)
    await repo.save(a2)

    // Second org with different agent
    const org2 = await seedOrg(env.DB)
    const user2 = await seedUser(env.DB, org2.id)
    const otherApp = Appraisal.create({
      id: nextId('app'),
      org_id: org2.id,
      property_address: 'Otra 1',
      neighborhood: 'Otro',
      city: 'CABA',
      property_type: 'departamento',
      covered_area: null, total_area: null, semi_area: null, weighted_area: null,
      strengths: null, weaknesses: null, opportunities: null, threats: null,
      publication_analysis: null, suggested_price: null, test_price: null,
      expected_close_price: null, usd_per_m2: null, canva_design_id: null,
      canva_edit_url: null, agent_id: user2.id, lead_id: null, status: 'draft',
      public_slug: null,
    })
    await repo.save(otherApp)

    const all = await repo.findByOrg(orgId)
    expect(all.length).toBe(2)
    expect(all.every(a => a.org_id === orgId)).toBe(true)

    const draftOnly = await repo.findByOrg(orgId, { stage: 'draft' })
    expect(draftOnly.length).toBe(1)
    expect(draftOnly[0]!.status).toBe('draft')

    const byAgent = await repo.findByOrg(orgId, { agent_id: agentId })
    expect(byAgent.length).toBe(2)
  })

  it('delete removes the row (scoped by org)', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const app = buildAppraisal()
    await repo.save(app)
    await repo.delete(app.id, orgId)
    const found = await repo.findById(app.id, orgId)
    expect(found).toBeNull()
  })

  it('findById includes comparables ordered by sort_order', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const app = buildAppraisal()
    await repo.save(app)

    // Insert 2 comparables directly (the port doesn't declare comparable mutators)
    await env.DB.prepare(
      `INSERT INTO appraisal_comparables (id, appraisal_id, address, total_area, covered_area, price, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(nextId('cmp'), app.id, 'Cmp A', 70, 60, 150000, 1).run()
    await env.DB.prepare(
      `INSERT INTO appraisal_comparables (id, appraisal_id, address, total_area, covered_area, price, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(nextId('cmp'), app.id, 'Cmp B', 80, 70, 170000, 0).run()

    const found = await repo.findById(app.id, orgId)
    expect(found).not.toBeNull()
    const comps = found!.comparables ?? []
    expect(comps.length).toBe(2)
    // Ordered by sort_order ASC
    expect(comps[0]!.address).toBe('Cmp B')
    expect(comps[1]!.address).toBe('Cmp A')
  })
})
