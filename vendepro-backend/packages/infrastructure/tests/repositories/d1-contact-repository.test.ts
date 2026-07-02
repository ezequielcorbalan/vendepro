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

describe('D1ContactRepository — searchByName', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  it('returns contacts matching the name query', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)

    // Insert contacts with unique names to avoid cross-test contamination
    const id1 = nextId('contact')
    const id2 = nextId('contact')
    await env.DB.prepare(
      `INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, agent_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'propietario', ?, datetime('now'))`,
    ).bind(id1, org.id, 'María González', '+54111', `${id1}@t.com`, user.id).run()
    await env.DB.prepare(
      `INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, agent_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'propietario', ?, datetime('now'))`,
    ).bind(id2, org.id, 'Carlos Pérez', '+54222', `${id2}@t.com`, user.id).run()

    const results = await repo.searchByName(org.id, 'María', 5)
    expect(results.length).toBe(1)
    expect(results[0]!.full_name).toBe('María González')
  })

  it('searchByName respects limit', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)

    for (let i = 0; i < 3; i++) {
      const id = nextId('contact')
      await env.DB.prepare(
        `INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, agent_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'propietario', ?, datetime('now'))`,
      ).bind(id, org.id, `Búsqueda Contacto ${i}`, `+5411${i}`, `${id}@t.com`, user.id).run()
    }

    const results = await repo.searchByName(org.id, 'Búsqueda Contacto', 2)
    expect(results.length).toBe(2)
  })
})

describe('D1ContactRepository — findByEmailOrPhone (dedup de import)', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  async function insert(orgId: string, agentId: string, email: string | null, phone: string | null) {
    const id = nextId('contact')
    await env.DB.prepare(
      `INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, agent_id, created_at)
       VALUES (?, ?, 'Dedup Test', ?, ?, 'otro', ?, datetime('now'))`,
    ).bind(id, orgId, phone, email, agentId).run()
    return id
  }

  it('encuentra por email normalizado (case/espacios)', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const id = await insert(org.id, user.id, 'Juan@Mail.com', null)

    const found = await repo.findByEmailOrPhone(org.id, '  juan@mail.com ', null)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(id)
  })

  it('encuentra por teléfono aunque difieran los prefijos (+54 9 vs 011)', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const id = await insert(org.id, user.id, null, '+54 9 11 5555-1234')

    const found = await repo.findByEmailOrPhone(org.id, null, '011 5555 1234')
    expect(found).not.toBeNull()
    expect(found!.id).toBe(id)
  })

  it('no cruza organizaciones', async () => {
    const repo = new D1ContactRepository(env.DB)
    const orgA = await seedOrg(env.DB)
    const orgB = await seedOrg(env.DB)
    const userA = await seedUser(env.DB, orgA.id)
    await insert(orgA.id, userA.id, 'scoped@mail.com', null)

    const found = await repo.findByEmailOrPhone(orgB.id, 'scoped@mail.com', null)
    expect(found).toBeNull()
  })

  it('devuelve null sin email ni teléfono, o sin match', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)

    expect(await repo.findByEmailOrPhone(org.id, null, null)).toBeNull()
    expect(await repo.findByEmailOrPhone(org.id, 'nadie@mail.com', '99999999')).toBeNull()
  })

  it('teléfonos demasiado cortos no matchean (evita falsos positivos)', async () => {
    const repo = new D1ContactRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    await insert(org.id, user.id, null, '111')

    const found = await repo.findByEmailOrPhone(org.id, null, '111')
    expect(found).toBeNull()
  })
})
