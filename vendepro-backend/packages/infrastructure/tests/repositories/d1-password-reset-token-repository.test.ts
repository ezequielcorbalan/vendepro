import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { PasswordResetToken } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1PasswordResetTokenRepository } from '../../src/repositories/d1-password-reset-token-repository'

describe('D1PasswordResetTokenRepository', () => {
  let env: TestEnv
  let orgId: string
  let userId: string

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
    userId = user.id
  })

  const makeToken = () => `${nextId('tok')}_${'a'.repeat(32)}`

  const buildToken = (overrides: Partial<Parameters<typeof PasswordResetToken.create>[0]> = {}) =>
    PasswordResetToken.create({
      token: makeToken(),
      user_id: userId,
      org_id: orgId,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      used: false,
      ...overrides,
    })

  it('save + findByToken round-trip (used:false maps to 0)', async () => {
    const repo = new D1PasswordResetTokenRepository(env.DB)
    const tok = buildToken()
    await repo.save(tok)

    const found = await repo.findByToken(tok.token)
    expect(found).not.toBeNull()
    const o = found!.toObject()
    expect(o.token).toBe(tok.token)
    expect(o.user_id).toBe(userId)
    expect(o.org_id).toBe(orgId)
    expect(o.used).toBe(false)

    // Verify the raw column is stored as INTEGER 0
    const raw = (await env.DB
      .prepare('SELECT used FROM password_reset_tokens WHERE token = ?')
      .bind(tok.token)
      .first()) as any
    expect(raw.used).toBe(0)
  })

  it('markUsed flips used to true (1)', async () => {
    const repo = new D1PasswordResetTokenRepository(env.DB)
    const tok = buildToken()
    await repo.save(tok)

    await repo.markUsed(tok.token)

    const found = await repo.findByToken(tok.token)
    expect(found).not.toBeNull()
    expect(found!.used).toBe(true)

    const raw = (await env.DB
      .prepare('SELECT used FROM password_reset_tokens WHERE token = ?')
      .bind(tok.token)
      .first()) as any
    expect(raw.used).toBe(1)
  })

  it('findByToken returns null for missing token', async () => {
    const repo = new D1PasswordResetTokenRepository(env.DB)
    const missing = await repo.findByToken('no_existe_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(missing).toBeNull()
  })

  it('deleteExpired removes expired tokens and returns count', async () => {
    const repo = new D1PasswordResetTokenRepository(env.DB)

    const expired1 = buildToken({
      expires_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    })
    const expired2 = buildToken({
      expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    })
    const valid = buildToken({
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    await repo.save(expired1)
    await repo.save(expired2)
    await repo.save(valid)

    const deletedCount = await repo.deleteExpired(new Date())
    expect(deletedCount).toBe(2)

    expect(await repo.findByToken(expired1.token)).toBeNull()
    expect(await repo.findByToken(expired2.token)).toBeNull()
    expect(await repo.findByToken(valid.token)).not.toBeNull()
  })
})
