import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Notification } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1NotificationRepository } from '../../src/repositories/d1-notification-repository'

describe('D1NotificationRepository', () => {
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

  const buildNotification = (overrides: Partial<Parameters<typeof Notification.create>[0]> = {}) =>
    Notification.create({
      id: nextId('ntf'),
      org_id: orgId,
      user_id: userId,
      kind: 'lead_assigned',
      title: 'Nuevo lead asignado',
      body: 'Se te asignó un nuevo lead',
      link_url: '/leads/123',
      read: false,
      ...overrides,
    })

  it('save + findByUserId returns notification with read:false', async () => {
    const repo = new D1NotificationRepository(env.DB)
    const ntf = buildNotification()
    await repo.save(ntf)

    const found = await repo.findByUserId(userId, orgId)
    expect(found.length).toBe(1)
    const o = found[0]!.toObject()
    expect(o.id).toBe(ntf.id)
    expect(o.user_id).toBe(userId)
    expect(o.org_id).toBe(orgId)
    expect(o.kind).toBe('lead_assigned')
    expect(o.title).toBe('Nuevo lead asignado')
    expect(o.body).toBe('Se te asignó un nuevo lead')
    expect(o.link_url).toBe('/leads/123')
    expect(o.read).toBe(false)
  })

  it('markRead flips read from false to true', async () => {
    const repo = new D1NotificationRepository(env.DB)
    const ntf = buildNotification()
    await repo.save(ntf)

    await repo.markRead(ntf.id, userId)

    const found = await repo.findByUserId(userId, orgId)
    expect(found.length).toBe(1)
    expect(found[0]!.read).toBe(true)

    const raw = (await env.DB
      .prepare('SELECT read FROM notifications WHERE id = ?')
      .bind(ntf.id)
      .first()) as any
    expect(raw.read).toBe(1)
  })

  it('findByUserId scopes by user and org (other user / other org do not see it)', async () => {
    const repo = new D1NotificationRepository(env.DB)
    const ntf = buildNotification()
    await repo.save(ntf)

    // Another user in the same org
    const otherUser = await seedUser(env.DB, orgId)
    const foundOtherUser = await repo.findByUserId(otherUser.id, orgId)
    expect(foundOtherUser.length).toBe(0)

    // Another org with its own user
    const otherOrg = await seedOrg(env.DB)
    const foundOtherOrg = await repo.findByUserId(userId, otherOrg.id)
    expect(foundOtherOrg.length).toBe(0)

    // Original user/org still sees it
    const original = await repo.findByUserId(userId, orgId)
    expect(original.length).toBe(1)
  })

  it('findByUserId orders by created_at DESC and respects limit', async () => {
    const repo = new D1NotificationRepository(env.DB)

    const older = buildNotification({
      title: 'Older',
      created_at: '2026-01-01T10:00:00.000Z',
    })
    const middle = buildNotification({
      title: 'Middle',
      created_at: '2026-02-01T10:00:00.000Z',
    })
    const newer = buildNotification({
      title: 'Newer',
      created_at: '2026-03-01T10:00:00.000Z',
    })
    await repo.save(older)
    await repo.save(middle)
    await repo.save(newer)

    const all = await repo.findByUserId(userId, orgId)
    expect(all.length).toBe(3)
    expect(all[0]!.title).toBe('Newer')
    expect(all[1]!.title).toBe('Middle')
    expect(all[2]!.title).toBe('Older')

    const limited = await repo.findByUserId(userId, orgId, 2)
    expect(limited.length).toBe(2)
    expect(limited[0]!.title).toBe('Newer')
    expect(limited[1]!.title).toBe('Middle')
  })
})
