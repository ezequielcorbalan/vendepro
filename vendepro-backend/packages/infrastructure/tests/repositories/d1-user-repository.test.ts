import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1UserRepository } from '../../src/repositories/d1-user-repository'

describe('D1UserRepository — extended methods', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  it('findFirstAdminByOrg returns admin when one exists', async () => {
    const repo = new D1UserRepository(env.DB)
    const org = await seedOrg(env.DB)
    await seedUser(env.DB, org.id, { role: 'agent' })
    const admin = await seedUser(env.DB, org.id, { role: 'admin' })

    const found = await repo.findFirstAdminByOrg(org.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(admin.id)
    expect(found!.role).toBe('admin')
  })

  it('findFirstAdminByOrg returns null when org has only agents', async () => {
    const repo = new D1UserRepository(env.DB)
    const org = await seedOrg(env.DB)
    await seedUser(env.DB, org.id, { role: 'agent' })
    await seedUser(env.DB, org.id, { role: 'agent' })

    const found = await repo.findFirstAdminByOrg(org.id)
    expect(found).toBeNull()
  })

  it('findFirstAdminByOrg returns earliest-created when multiple admins', async () => {
    const repo = new D1UserRepository(env.DB)
    const org = await seedOrg(env.DB)

    // Insert admins with explicit timestamps so we control ordering
    const admin1Id = nextId('user')
    const admin2Id = nextId('user')
    await env.DB
      .prepare(
        `INSERT INTO users (id, org_id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, 'x', ?, 'admin', ?)`,
      )
      .bind(admin1Id, org.id, `${admin1Id}@t.com`, 'Admin One', '2020-01-01T00:00:00.000Z')
      .run()
    await env.DB
      .prepare(
        `INSERT INTO users (id, org_id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, 'x', ?, 'admin', ?)`,
      )
      .bind(admin2Id, org.id, `${admin2Id}@t.com`, 'Admin Two', '2021-01-01T00:00:00.000Z')
      .run()

    const found = await repo.findFirstAdminByOrg(org.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(admin1Id)
  })

  it('findProfileById returns user when present, null when missing', async () => {
    const repo = new D1UserRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)

    const found = await repo.findProfileById(user.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(user.id)
    expect(found!.email).toBe(user.email)

    const missing = await repo.findProfileById('no_such_user')
    expect(missing).toBeNull()
  })

  it('updateProfile patches specified fields', async () => {
    const repo = new D1UserRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id, { full_name: 'Old Name' })

    await repo.updateProfile(user.id, {
      full_name: 'New Name',
      phone: '+541199999999',
    })

    const row = await env.DB
      .prepare('SELECT full_name, email, phone, photo_url FROM users WHERE id = ?')
      .bind(user.id)
      .first() as any

    expect(row.full_name).toBe('New Name')
    expect(row.email).toBe(user.email) // unchanged
    expect(row.phone).toBe('+541199999999')
  })

  it('updateProfile with empty patch is a no-op', async () => {
    const repo = new D1UserRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id, { full_name: 'Original' })

    await repo.updateProfile(user.id, {})

    const row = await env.DB
      .prepare('SELECT full_name, email FROM users WHERE id = ?')
      .bind(user.id)
      .first() as any
    expect(row.full_name).toBe('Original')
    expect(row.email).toBe(user.email)
  })
})
