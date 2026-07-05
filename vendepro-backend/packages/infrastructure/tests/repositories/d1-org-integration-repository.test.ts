import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { OrgIntegration } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, nextId } from '../helpers/fixtures'
import { D1OrgIntegrationRepository } from '../../src/repositories/d1-org-integration-repository'
import { D1IntegrationLinkRepository } from '../../src/repositories/d1-integration-link-repository'
import { D1IntegrationSyncLogRepository } from '../../src/repositories/d1-integration-sync-log-repository'

describe('D1 integration repositories', () => {
  let env: TestEnv
  let orgId: string

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
  })

  function buildIntegration(overrides: Record<string, unknown> = {}) {
    return OrgIntegration.create({
      id: nextId('integ'),
      org_id: orgId,
      provider: 'kiteprop',
      credentials_encrypted: 'iv:cipher',
      enabled: true,
      ...overrides,
    })
  }

  describe('D1OrgIntegrationRepository', () => {
    it('guarda y recupera por org+provider', async () => {
      const repo = new D1OrgIntegrationRepository(env.DB)
      const integ = buildIntegration({ name: 'KiteProp Marcela' })
      await repo.save(integ)

      const found = await repo.findByOrgAndProvider(orgId, 'kiteprop')
      expect(found).not.toBeNull()
      expect(found!.id).toBe(integ.id)
      expect(found!.name).toBe('KiteProp Marcela')
      expect(found!.credentials_encrypted).toBe('iv:cipher')
      expect(found!.enabled).toBe(true)
    })

    it('upsert por (org, provider): el segundo save actualiza en vez de duplicar', async () => {
      const repo = new D1OrgIntegrationRepository(env.DB)
      const first = buildIntegration()
      await repo.save(first)

      first.update({ credentials_encrypted: 'iv:otro', enabled: false, last_sync_at: '2026-07-05T12:00:00.000Z' })
      await repo.save(first)

      const found = await repo.findByOrgAndProvider(orgId, 'kiteprop')
      expect(found!.credentials_encrypted).toBe('iv:otro')
      expect(found!.enabled).toBe(false)
      expect(found!.last_sync_at).toBe('2026-07-05T12:00:00.000Z')

      const all = await repo.findEnabledByProvider('kiteprop')
      expect(all.filter(i => i.org_id === orgId)).toHaveLength(0) // quedó disabled
    })

    it('findEnabledByProvider devuelve solo habilitadas del provider', async () => {
      const repo = new D1OrgIntegrationRepository(env.DB)
      await repo.save(buildIntegration({ enabled: true }))
      const otherOrg = await seedOrg(env.DB)
      await repo.save(OrgIntegration.create({
        id: nextId('integ'), org_id: otherOrg.id, provider: 'kiteprop', enabled: false,
      }))

      const enabled = await repo.findEnabledByProvider('kiteprop')
      expect(enabled.some(i => i.org_id === orgId)).toBe(true)
      expect(enabled.some(i => i.org_id === otherOrg.id)).toBe(false)
    })

    it('devuelve null si no existe', async () => {
      const repo = new D1OrgIntegrationRepository(env.DB)
      expect(await repo.findByOrgAndProvider(orgId, 'kiteprop')).toBeNull()
    })
  })

  describe('D1IntegrationLinkRepository', () => {
    it('guarda links y los recupera individual y en batch', async () => {
      const repo = new D1IntegrationLinkRepository(env.DB)
      await repo.save(orgId, 'kiteprop', '100', 'contact-a')
      await repo.save(orgId, 'kiteprop', '200', 'contact-b')

      expect(await repo.findContactId(orgId, 'kiteprop', '100')).toBe('contact-a')
      expect(await repo.findContactId(orgId, 'kiteprop', '999')).toBeNull()

      const map = await repo.findContactIds(orgId, 'kiteprop', ['100', '200', '999'])
      expect(map).toEqual({ '100': 'contact-a', '200': 'contact-b' })
    })

    it('INSERT OR IGNORE: un link existente no se pisa', async () => {
      const repo = new D1IntegrationLinkRepository(env.DB)
      await repo.save(orgId, 'kiteprop', '100', 'contact-a')
      await repo.save(orgId, 'kiteprop', '100', 'contact-otro')
      expect(await repo.findContactId(orgId, 'kiteprop', '100')).toBe('contact-a')
    })

    it('no cruza org ni provider', async () => {
      const repo = new D1IntegrationLinkRepository(env.DB)
      await repo.save(orgId, 'kiteprop', '100', 'contact-a')
      const otherOrg = await seedOrg(env.DB)
      expect(await repo.findContactId(otherOrg.id, 'kiteprop', '100')).toBeNull()
      expect(await repo.findContactId(orgId, 'tokko', '100')).toBeNull()
    })

    it('findContactIds con lista vacía devuelve {} sin query', async () => {
      const repo = new D1IntegrationLinkRepository(env.DB)
      expect(await repo.findContactIds(orgId, 'kiteprop', [])).toEqual({})
    })
  })

  describe('D1IntegrationSyncLogRepository', () => {
    it('guarda entradas y lista por org en orden DESC', async () => {
      const repo = new D1IntegrationSyncLogRepository(env.DB)
      const base = {
        org_id: orgId, integration_id: 'integ-1',
        contacts_created: 3, contacts_skipped: 2, error: null, finished_at: null,
      }
      await repo.save({ ...base, id: nextId('log'), kind: 'auto', status: 'ok', started_at: '2026-07-01T10:00:00.000Z' })
      await repo.save({ ...base, id: nextId('log'), kind: 'backfill', status: 'partial', started_at: '2026-07-02T10:00:00.000Z', error: 'rate limit' })

      const list = await repo.listByOrg(orgId, 10)
      expect(list).toHaveLength(2)
      expect(list[0].kind).toBe('backfill')
      expect(list[0].status).toBe('partial')
      expect(list[0].error).toBe('rate limit')
      expect(list[1].kind).toBe('auto')
      expect(list[1].contacts_created).toBe(3)
    })

    it('respeta el límite y no cruza orgs', async () => {
      const repo = new D1IntegrationSyncLogRepository(env.DB)
      for (let i = 0; i < 3; i++) {
        await repo.save({
          id: nextId('log'), org_id: orgId, integration_id: 'integ-1', kind: 'auto', status: 'ok',
          contacts_created: 0, contacts_skipped: 0, error: null,
          started_at: `2026-07-0${i + 1}T10:00:00.000Z`, finished_at: null,
        })
      }
      expect(await repo.listByOrg(orgId, 2)).toHaveLength(2)
      const otherOrg = await seedOrg(env.DB)
      expect(await repo.listByOrg(otherOrg.id, 10)).toHaveLength(0)
    })
  })
})
