import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { FichaTasacion } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1FichaRepository } from '../../src/repositories/d1-ficha-repository'

describe('D1FichaRepository', () => {
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

  const buildFicha = (overrides: Partial<Parameters<typeof FichaTasacion.create>[0]> = {}) =>
    FichaTasacion.create({
      id: nextId('ficha'),
      org_id: orgId,
      agent_id: agentId,
      lead_id: null,
      appraisal_id: null,
      inspection_date: '2026-03-15',
      address: 'Calle Falsa 742',
      neighborhood: 'Recoleta',
      property_type: 'departamento',
      floor_number: '5',
      elevators: '2',
      age: '20',
      building_category: 'A',
      property_condition: 'buena',
      covered_area: 75,
      semi_area: 5,
      uncovered_area: 0,
      m2_value_neighborhood: 3000,
      m2_value_zone: 2800,
      bedrooms: 2,
      bathrooms: 1,
      storage_rooms: 0,
      parking_spots: 1,
      air_conditioning: 2,
      bedroom_dimensions: '3x3',
      living_dimensions: '4x5',
      kitchen_dimensions: '2x3',
      bathroom_dimensions: '2x2',
      floor_type: 'parquet',
      disposition: 'frente',
      orientation: 'norte',
      balcony_type: 'frances',
      heating_type: 'radiadores',
      noise_level: 'bajo',
      amenities: 'SUM',
      is_professional: 0,
      is_occupied: 1,
      is_credit_eligible: 1,
      sells_to_buy: 0,
      expenses: 45000,
      abl: 2000,
      aysa: 1500,
      notes: 'Ficha test',
      photos: JSON.stringify(['https://img/1.jpg', 'https://img/2.jpg']),
      ...overrides,
    })

  it('save + findById round-trip persists representative fields', async () => {
    const repo = new D1FichaRepository(env.DB)
    const ficha = buildFicha()
    await repo.save(ficha)

    const found = await repo.findById(ficha.id, orgId)
    expect(found).not.toBeNull()
    const o = found!.toObject()
    expect(o.id).toBe(ficha.id)
    expect(o.org_id).toBe(orgId)
    expect(o.agent_id).toBe(agentId)
    expect(o.address).toBe('Calle Falsa 742')
    expect(o.neighborhood).toBe('Recoleta')
    expect(o.covered_area).toBe(75)
    expect(o.bedrooms).toBe(2)
    expect(o.bathrooms).toBe(1)
    expect(o.expenses).toBe(45000)
    expect(o.is_occupied).toBe(1)
    expect(o.photos).toBe(JSON.stringify(['https://img/1.jpg', 'https://img/2.jpg']))
    expect(o.inspection_date).toBe('2026-03-15')
  })

  it('findByAppraisal returns fichas bound to that appraisal within org', async () => {
    const repo = new D1FichaRepository(env.DB)

    // Create an appraisal (FK target in some deployments; schema has appraisal_id as plain TEXT)
    const appraisalId = nextId('app')
    await env.DB
      .prepare(
        `INSERT INTO appraisals (id, org_id, property_address, neighborhood, city, property_type, agent_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'CABA', 'departamento', ?, 'draft', datetime('now'), datetime('now'))`,
      )
      .bind(appraisalId, orgId, 'X', 'Y', agentId)
      .run()

    const f1 = buildFicha({ appraisal_id: appraisalId })
    const f2 = buildFicha({ appraisal_id: null })
    await repo.save(f1)
    await repo.save(f2)

    const found = await repo.findByAppraisal(appraisalId, orgId)
    expect(found.length).toBe(1)
    expect(found[0]!.id).toBe(f1.id)
  })

  it('scopes queries by organization', async () => {
    const repo = new D1FichaRepository(env.DB)
    const mine = buildFicha()
    await repo.save(mine)

    const org2 = await seedOrg(env.DB)
    const user2 = await seedUser(env.DB, org2.id)
    const other = buildFicha({ org_id: org2.id, agent_id: user2.id })
    await repo.save(other)

    const foundMine = await repo.findById(mine.id, orgId)
    expect(foundMine).not.toBeNull()
    // Cannot load another org's ficha via my org id
    const foundOther = await repo.findById(other.id, orgId)
    expect(foundOther).toBeNull()
  })

  it('delete removes a ficha scoped by org', async () => {
    const repo = new D1FichaRepository(env.DB)
    const ficha = buildFicha()
    await repo.save(ficha)
    await repo.delete(ficha.id, orgId)
    const found = await repo.findById(ficha.id, orgId)
    expect(found).toBeNull()
  })

  it('findPublicBySlug returns null (fichas_tasacion has no public_slug column)', async () => {
    const repo = new D1FichaRepository(env.DB)
    const result = await repo.findPublicBySlug('whatever')
    expect(result).toBeNull()
  })
})
