import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1PropertyRepository } from '../../src/repositories/d1-property-repository'

describe('D1PropertyRepository', () => {
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

  it('findById returns property with contact_id populated (no duplicate key bug)', async () => {
    const contactId = nextId('contact')
    const propId = nextId('prop')
    const slug = `slug-${propId}`

    // Insert contact — the v2 schema uses columns: id, org_id, full_name, phone, email,
    // contact_type, neighborhood, notes, source, agent_id, created_at. No updated_at column.
    await env.DB
      .prepare(
        `INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, agent_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(contactId, orgId, 'Juan Propietario', '+541112345678', 'juan@test.com', 'propietario', agentId)
      .run()

    // Insert property — using columns from the v2 schema plus contact_id added via ALTER above.
    await env.DB
      .prepare(
        `INSERT INTO properties (
           id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
           asking_price, currency, owner_name, owner_phone, owner_email, public_slug,
           agent_id, status, contact_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(
        propId,
        orgId,
        'Av. Corrientes 1234',
        'Balvanera',
        'Buenos Aires',
        'departamento',
        2,
        65.5,
        150000,
        'USD',
        'Juan Propietario',
        '+541112345678',
        'juan@test.com',
        slug,
        agentId,
        'active',
        contactId,
      )
      .run()

    const repo = new D1PropertyRepository(env.DB)
    const prop = await repo.findById(propId, orgId)

    expect(prop).not.toBeNull()
    const obj = prop!.toObject()
    expect(obj.id).toBe(propId)
    expect(obj.org_id).toBe(orgId)
    expect(obj.contact_id).toBe(contactId)
  })
})
