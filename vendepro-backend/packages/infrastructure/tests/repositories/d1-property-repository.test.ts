import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1PropertyRepository } from '../../src/repositories/d1-property-repository'

/**
 * Regression test for the `contact_id` duplicate-key bug in D1PropertyRepository.toEntity.
 *
 * The v2 initial schema (migrations_v2/000_initial.sql) creates `properties` WITHOUT several
 * columns the current repository maps (contact_id, lead_id, operation_type*, commercial_stage*,
 * status_id). Those columns were added by later legacy migrations. We ALTER the table here so
 * the repository's mapping has the columns it expects, without pulling the whole legacy
 * migrations_v2 chain into the test bootstrap.
 */
async function ensurePropertyExtraColumns(DB: D1Database): Promise<void> {
  const addColumn = async (sql: string) => {
    try {
      await DB.prepare(sql).run()
    } catch (err) {
      // Ignore "duplicate column" errors — this can run more than once across tests.
      const msg = String((err as any)?.message ?? err)
      if (!/duplicate column/i.test(msg)) throw err
    }
  }
  await addColumn(`ALTER TABLE properties ADD COLUMN contact_id TEXT REFERENCES contacts(id)`)
  await addColumn(`ALTER TABLE properties ADD COLUMN lead_id TEXT REFERENCES leads(id)`)
  await addColumn(`ALTER TABLE properties ADD COLUMN operation_type TEXT DEFAULT 'venta'`)
  await addColumn(`ALTER TABLE properties ADD COLUMN operation_type_id INTEGER`)
  await addColumn(`ALTER TABLE properties ADD COLUMN commercial_stage TEXT`)
  await addColumn(`ALTER TABLE properties ADD COLUMN commercial_stage_id INTEGER`)
  await addColumn(`ALTER TABLE properties ADD COLUMN status_id INTEGER`)
}

describe('D1PropertyRepository', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string

  beforeAll(async () => {
    env = await createTestDB()
    await ensurePropertyExtraColumns(env.DB)
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
