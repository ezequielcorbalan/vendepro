import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1CalendarRepository } from '../../src/repositories/d1-calendar-repository'

describe('D1CalendarRepository — findByOrgAndDate', () => {
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

  async function insertEvent(
    evtOrgId: string,
    evtAgentId: string,
    startAt: string,
    completed = 0,
    id = nextId('evt'),
  ) {
    await env.DB
      .prepare(
        `INSERT INTO calendar_events (id, org_id, agent_id, title, event_type, start_at, end_at, all_day, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))`,
      )
      .bind(id, evtOrgId, evtAgentId, 'Test Event', 'llamada', startAt, startAt, completed)
      .run()
    return id
  }

  it('returns events for the given date', async () => {
    const repo = new D1CalendarRepository(env.DB)
    const id1 = await insertEvent(orgId, agentId, '2026-04-17T10:00:00.000Z')
    await insertEvent(orgId, agentId, '2026-04-18T10:00:00.000Z') // different day

    const results = await repo.findByOrgAndDate(orgId, '2026-04-17')
    expect(results.some(e => e.id === id1)).toBe(true)
    // all results should be on the 17th
    expect(results.every(e => e.start_at.startsWith('2026-04-17'))).toBe(true)
  })

  it('excludes completed events', async () => {
    const repo = new D1CalendarRepository(env.DB)
    const completedId = await insertEvent(orgId, agentId, '2026-04-22T10:00:00.000Z', 1)
    const activeId = await insertEvent(orgId, agentId, '2026-04-22T11:00:00.000Z', 0)

    const results = await repo.findByOrgAndDate(orgId, '2026-04-22')
    const ids = results.map(e => e.id)
    expect(ids).toContain(activeId)
    expect(ids).not.toContain(completedId)
  })

  it('returns empty array when no events exist for that date', async () => {
    const repo = new D1CalendarRepository(env.DB)
    const results = await repo.findByOrgAndDate(orgId, '2099-12-31')
    expect(results).toEqual([])
  })
})
