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
