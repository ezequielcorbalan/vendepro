import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1ActivityRepository } from '../../src/repositories/d1-activity-repository'

describe('D1ActivityRepository — findById', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  async function insertActivity(orgId: string, agentId: string, id = nextId('act')) {
    await env.DB
      .prepare(
        `INSERT INTO activities (id, org_id, agent_id, activity_type, description, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(id, orgId, agentId, 'llamada', 'Test activity')
      .run()
    return id
  }

  it('findById returns the activity when present in the org', async () => {
    const repo = new D1ActivityRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const actId = await insertActivity(org.id, user.id)

    const found = await repo.findById(actId, org.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(actId)
    expect(found!.org_id).toBe(org.id)
    expect(found!.activity_type).toBe('llamada')
  })

  it('findById returns null when called with wrong org (scoping)', async () => {
    const repo = new D1ActivityRepository(env.DB)
    const orgA = await seedOrg(env.DB)
    const orgB = await seedOrg(env.DB)
    const userA = await seedUser(env.DB, orgA.id)
    const actId = await insertActivity(orgA.id, userA.id)

    const found = await repo.findById(actId, orgB.id)
    expect(found).toBeNull()
  })

  it('findById returns null for non-existent id', async () => {
    const repo = new D1ActivityRepository(env.DB)
    const org = await seedOrg(env.DB)

    const found = await repo.findById('missing_id_xyz', org.id)
    expect(found).toBeNull()
  })
})
