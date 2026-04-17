import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
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

describe('D1ActivityRepository — new methods', () => {
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
    const user = await seedUser(env.DB, org.id)
    agentId = user.id
  })

  async function insertActivity(
    actOrgId: string,
    actAgentId: string,
    type: string,
    createdAt: string,
    id = nextId('act'),
  ) {
    await env.DB
      .prepare(
        `INSERT INTO activities (id, org_id, agent_id, activity_type, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, actOrgId, actAgentId, type, 'Test', createdAt)
      .run()
    return id
  }

  it('findByOrgSince returns only activities after the cutoff', async () => {
    const repo = new D1ActivityRepository(env.DB)
    const pastDate = '2020-01-01T00:00:00.000Z'
    const recentDate = new Date(Date.now() - 60_000).toISOString() // 1 min ago

    await insertActivity(orgId, agentId, 'llamada', pastDate)
    const recentId = await insertActivity(orgId, agentId, 'reunion', recentDate)

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const results = await repo.findByOrgSince(orgId, cutoff)
    const ids = results.map(r => r.id)
    expect(ids).toContain(recentId)
    expect(ids).not.toContain('old_activity')
  })

  it('findByOrgSince filters by agentId when provided', async () => {
    const repo = new D1ActivityRepository(env.DB)
    const otherUser = await seedUser(env.DB, orgId)
    const recentDate = new Date(Date.now() - 60_000).toISOString()

    const ownId = await insertActivity(orgId, agentId, 'llamada', recentDate)
    await insertActivity(orgId, otherUser.id, 'reunion', recentDate)

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const results = await repo.findByOrgSince(orgId, cutoff, agentId)
    expect(results.every(r => r.agent_id === agentId)).toBe(true)
    expect(results.some(r => r.id === ownId)).toBe(true)
  })

  it('findLatestByOrg returns N most recent activities with agent_name', async () => {
    const repo = new D1ActivityRepository(env.DB)
    const t1 = '2026-04-01T10:00:00.000Z'
    const t2 = '2026-04-01T11:00:00.000Z'
    const t3 = '2026-04-01T12:00:00.000Z'
    await insertActivity(orgId, agentId, 'llamada', t1)
    await insertActivity(orgId, agentId, 'reunion', t2)
    const latestId = await insertActivity(orgId, agentId, 'visita_captacion', t3)

    const results = await repo.findLatestByOrg(orgId, 2)
    expect(results.length).toBe(2)
    expect(results[0]!.id).toBe(latestId) // most recent first
    // agent_name should be joined from users table
    expect(results[0]!.agent_name).toBe('Test User')
  })

  it('aggregateByTypeSince returns grouped counts by activity_type', async () => {
    const repo = new D1ActivityRepository(env.DB)
    const recentDate = new Date(Date.now() - 60_000).toISOString()

    await insertActivity(orgId, agentId, 'llamada', recentDate)
    await insertActivity(orgId, agentId, 'llamada', recentDate)
    await insertActivity(orgId, agentId, 'reunion', recentDate)

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const results = await repo.aggregateByTypeSince(orgId, agentId, cutoff)

    const llamadasEntry = results.find(r => r.activity_type === 'llamada')
    const reunionesEntry = results.find(r => r.activity_type === 'reunion')
    expect(llamadasEntry?.count).toBeGreaterThanOrEqual(2)
    expect(reunionesEntry?.count).toBeGreaterThanOrEqual(1)
  })
})
