import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1ContactRepository } from '../../src/repositories/d1-contact-repository'

async function insertContact(db: D1Database, orgId: string, agentId: string, id = nextId('contact')) {
  await db
    .prepare(
      `INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, agent_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'propietario', ?, datetime('now'))`,
    )
    .bind(id, orgId, 'Test Contact', '+541199999', `${id}@t.com`, agentId)
    .run()
  return id
}

describe('D1ContactRepository — findWithLeadsAndProperties', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  it('returns contact with empty arrays when no leads/properties reference it', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const contactId = await insertContact(env.DB, org.id, user.id)

    const result = await repo.findWithLeadsAndProperties(contactId, org.id)
    expect(result).not.toBeNull()
    expect(result!.contact.id).toBe(contactId)
    expect(result!.leads).toEqual([])
    expect(result!.properties).toEqual([])
  })

  it('returns arrays with the correct entries when leads and properties exist', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const contactId = await insertContact(env.DB, org.id, user.id)

    const lead1 = nextId('lead')
    await env.DB
      .prepare(
        `INSERT INTO leads (id, org_id, full_name, source, stage, contact_id, created_at, updated_at)
         VALUES (?, ?, ?, 'web', 'nuevo', ?, datetime('now'), datetime('now'))`,
      )
      .bind(lead1, org.id, 'Lead Uno', contactId)
      .run()

    const prop1 = nextId('prop')
    await env.DB
      .prepare(
        `INSERT INTO properties (id, org_id, address, neighborhood, city, property_type, public_slug, owner_name, agent_id, status, contact_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'Buenos Aires', 'departamento', ?, 'Owner', ?, 'active', ?, datetime('now'), datetime('now'))`,
      )
      .bind(prop1, org.id, 'Calle Falsa 123', 'Palermo', `slug-${prop1}`, user.id, contactId)
      .run()

    const result = await repo.findWithLeadsAndProperties(contactId, org.id)
    expect(result).not.toBeNull()
    expect(result!.contact.id).toBe(contactId)
    expect(result!.leads.length).toBe(1)
    expect(result!.leads[0]!.id).toBe(lead1)
    expect(result!.leads[0]!.full_name).toBe('Lead Uno')
    expect(result!.leads[0]!.stage).toBe('nuevo')
    expect(result!.properties.length).toBe(1)
    expect(result!.properties[0]!.id).toBe(prop1)
    expect(result!.properties[0]!.address).toBe('Calle Falsa 123')
    expect(result!.properties[0]!.status).toBe('active')
  })

  it('returns null when contact does not exist', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)

    const result = await repo.findWithLeadsAndProperties('missing_contact_id', org.id)
    expect(result).toBeNull()
  })

  it('returns null when contact is in another org (scoping)', async () => {
    const repo = new D1ContactRepository(env.DB)
    const orgA = await seedOrg(env.DB)
    const orgB = await seedOrg(env.DB)
    const userA = await seedUser(env.DB, orgA.id)
    const contactId = await insertContact(env.DB, orgA.id, userA.id)

    const result = await repo.findWithLeadsAndProperties(contactId, orgB.id)
    expect(result).toBeNull()
  })
})
