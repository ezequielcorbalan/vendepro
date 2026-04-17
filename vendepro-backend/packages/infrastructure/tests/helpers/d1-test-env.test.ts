import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from './d1-test-env'
import { seedOrg, seedUser } from './fixtures'

describe('d1 test env', () => {
  let env: TestEnv
  beforeAll(async () => {
    env = await createTestDB()
  })
  afterAll(async () => {
    await closeTestDB(env)
  })

  it('boots Miniflare and applies schema', async () => {
    const { id } = await seedOrg(env.DB)
    const row = await env.DB.prepare('SELECT id, slug FROM organizations WHERE id = ?')
      .bind(id)
      .first()
    expect(row).toBeTruthy()
    expect((row as any).id).toBe(id)
  })

  it('can seed users linked to an org', async () => {
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id, { role: 'admin' })
    const row = await env.DB.prepare('SELECT id, org_id, role FROM users WHERE id = ?')
      .bind(user.id)
      .first()
    expect(row).toBeTruthy()
    expect((row as any).org_id).toBe(org.id)
    expect((row as any).role).toBe('admin')
  })
})
