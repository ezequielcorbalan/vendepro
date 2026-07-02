import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1TagRepository } from '../../src/repositories/d1-tag-repository'
import { Tag } from '@vendepro/core'

async function insertLead(db: D1Database, orgId: string, id = nextId('lead')) {
  await db
    .prepare(
      `INSERT INTO leads (id, org_id, full_name, source, stage, created_at, updated_at)
       VALUES (?, ?, 'Lead Test', 'api', 'nuevo', datetime('now'), datetime('now'))`,
    )
    .bind(id, orgId)
    .run()
  return id
}

function makeTag(orgId: string, name: string) {
  return Tag.create({ id: nextId('tag'), org_id: orgId, name, color: '#6366f1', is_default: 0 })
}

describe('D1TagRepository', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  it('save + findByName (case-insensitive)', async () => {
    const repo = new D1TagRepository(env.DB)
    const org = await seedOrg(env.DB)
    const tag = makeTag(org.id, 'zonaprop')
    await repo.save(tag)

    const found = await repo.findByName(org.id, 'ZonaProp')
    expect(found).not.toBeNull()
    expect(found!.id).toBe(tag.id)

    const notFound = await repo.findByName(org.id, 'inexistente')
    expect(notFound).toBeNull()
  })

  it('addToLead vincula contra el schema real y findByLead lo devuelve', async () => {
    const repo = new D1TagRepository(env.DB)
    const org = await seedOrg(env.DB)
    await seedUser(env.DB, org.id)
    const leadId = await insertLead(env.DB, org.id)
    const tag = makeTag(org.id, 'tasacion-web')
    await repo.save(tag)

    await repo.addToLead(leadId, tag.id, org.id)
    // idempotente: repetir no falla ni duplica
    await repo.addToLead(leadId, tag.id, org.id)

    const tags = await repo.findByLead(leadId, org.id)
    expect(tags.length).toBe(1)
    expect(tags[0]!.name).toBe('tasacion-web')
  })

  it('addToLead NO vincula un tag de otra org', async () => {
    const repo = new D1TagRepository(env.DB)
    const orgA = await seedOrg(env.DB)
    const orgB = await seedOrg(env.DB)
    const leadId = await insertLead(env.DB, orgA.id)
    const foreignTag = makeTag(orgB.id, 'ajeno')
    await repo.save(foreignTag)

    await repo.addToLead(leadId, foreignTag.id, orgA.id)
    const tags = await repo.findByLead(leadId, orgA.id)
    expect(tags.length).toBe(0)
  })

  it('removeFromLead desvincula', async () => {
    const repo = new D1TagRepository(env.DB)
    const org = await seedOrg(env.DB)
    const leadId = await insertLead(env.DB, org.id)
    const tag = makeTag(org.id, 'contactado')
    await repo.save(tag)
    await repo.addToLead(leadId, tag.id, org.id)

    await repo.removeFromLead(leadId, tag.id, org.id)
    const tags = await repo.findByLead(leadId, org.id)
    expect(tags.length).toBe(0)
  })
})

describe('D1TagRepository — findByContactIds', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  async function insertContact(orgId: string, agentId: string) {
    const id = nextId('contact')
    await env.DB.prepare(
      `INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, agent_id, created_at)
       VALUES (?, ?, 'Contacto Tags', '+54111', ?, 'propietario', ?, datetime('now'))`,
    ).bind(id, orgId, `${id}@t.com`, agentId).run()
    return id
  }

  async function insertLeadWithContact(orgId: string, contactId: string) {
    const leadId = nextId('lead')
    await env.DB.prepare(
      `INSERT INTO leads (id, org_id, full_name, source, stage, contact_id, created_at, updated_at)
       VALUES (?, ?, 'Lead Tag', 'api', 'nuevo', ?, datetime('now'), datetime('now'))`,
    ).bind(leadId, orgId, contactId).run()
    return leadId
  }

  it('agrupa los tags de los leads por contact_id, sin duplicados', async () => {
    const repo = new D1TagRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)

    const contactId = await insertContact(org.id, user.id)
    const otroContacto = await insertContact(org.id, user.id)
    // dos leads del mismo contacto comparten un tag → no debe duplicarse
    const lead1 = await insertLeadWithContact(org.id, contactId)
    const lead2 = await insertLeadWithContact(org.id, contactId)
    const tag = makeTag(org.id, `compartido-${contactId}`)
    await repo.save(tag)
    await repo.addToLead(lead1, tag.id, org.id)
    await repo.addToLead(lead2, tag.id, org.id)

    const result = await repo.findByContactIds([contactId, otroContacto], org.id)
    expect(result[contactId]!.length).toBe(1)
    expect(result[contactId]![0]!.name).toBe(`compartido-${contactId}`)
    expect(result[otroContacto]).toBeUndefined()
  })

  it('lista vacía de contactos devuelve objeto vacío', async () => {
    const repo = new D1TagRepository(env.DB)
    const org = await seedOrg(env.DB)
    const result = await repo.findByContactIds([], org.id)
    expect(result).toEqual({})
  })

  it('no devuelve tags de otra org (scoping)', async () => {
    const repo = new D1TagRepository(env.DB)
    const orgA = await seedOrg(env.DB)
    const orgB = await seedOrg(env.DB)
    const user = await seedUser(env.DB, orgA.id)

    const contactId = await insertContact(orgA.id, user.id)
    const leadId = await insertLeadWithContact(orgA.id, contactId)
    const tag = makeTag(orgA.id, `scoped-${contactId}`)
    await repo.save(tag)
    await repo.addToLead(leadId, tag.id, orgA.id)

    const result = await repo.findByContactIds([contactId], orgB.id)
    expect(result[contactId]).toBeUndefined()
  })
})
