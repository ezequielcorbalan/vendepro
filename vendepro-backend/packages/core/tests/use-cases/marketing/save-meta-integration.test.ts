import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SaveMetaIntegrationUseCase } from '../../../src/application/use-cases/marketing/save-meta-integration'

const encrypt = vi.fn(async (s: string) => `enc(${s})`)

function makeRepo(existing: any = null) {
  return {
    findByOrg: vi.fn().mockResolvedValue(existing),
    save: vi.fn().mockResolvedValue(undefined),
  } as any
}

function savedObject(repo: any) {
  return repo.save.mock.calls[0][0].toObject()
}

describe('SaveMetaIntegrationUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('guarda el access token la primera vez (sin integración previa)', async () => {
    const repo = makeRepo(null)
    const uc = new SaveMetaIntegrationUseCase(repo, encrypt)
    await uc.execute({ orgId: 'org_mg', pixel_id: '123', access_token: 'EAAtoken', enabled: true })

    const o = savedObject(repo)
    expect(o.access_token_encrypted).toBe('enc(EAAtoken)')
    expect(o.pixel_id).toBe('123')
  })

  it('guarda el ad_account_id y lo preserva en updates parciales', async () => {
    const repo = makeRepo(null)
    const uc = new SaveMetaIntegrationUseCase(repo, encrypt)
    await uc.execute({ orgId: 'org_mg', ad_account_id: 'act_123456' })
    expect(savedObject(repo).ad_account_id).toBe('act_123456')

    const existing = {
      access_token_encrypted: null,
      ga4_api_secret_encrypted: null,
      pixel_id: null,
      stape_endpoint: null,
      gtm_container_id: null,
      test_event_code: null,
      ad_account_id: 'act_123456',
      ga4_measurement_id: null,
      enabled: true,
      ga4_enabled: false,
      update: function (p: any) { Object.assign(this, p) },
      toObject: function () { const { update, toObject, ...rest } = this as any; return rest },
    }
    const repo2 = makeRepo(existing)
    const uc2 = new SaveMetaIntegrationUseCase(repo2, encrypt)
    await uc2.execute({ orgId: 'org_mg', pixel_id: '999' })
    expect(savedObject(repo2).ad_account_id).toBe('act_123456') // undefined preserva
  })

  it('normaliza el stape_endpoint sin esquema a https://', async () => {
    const repo = makeRepo(null)
    const uc = new SaveMetaIntegrationUseCase(repo, encrypt)
    await uc.execute({ orgId: 'org_mg', stape_endpoint: 'sst.midominio.com' })
    expect(savedObject(repo).stape_endpoint).toBe('https://sst.midominio.com')
  })

  it('respeta un endpoint que ya trae esquema', async () => {
    const repo = makeRepo(null)
    const uc = new SaveMetaIntegrationUseCase(repo, encrypt)
    await uc.execute({ orgId: 'org_mg', stape_endpoint: 'https://sst.midominio.com' })
    expect(savedObject(repo).stape_endpoint).toBe('https://sst.midominio.com')
  })

  it("'' o null limpian el campo; undefined lo preserva", async () => {
    const existing = {
      access_token_encrypted: 'enc(viejo)',
      ga4_api_secret_encrypted: null,
      pixel_id: '123',
      stape_endpoint: 'https://sst.x.com',
      gtm_container_id: 'GTM-1',
      test_event_code: 'mail@x.com',
      ga4_measurement_id: 'G-1',
      enabled: true,
      ga4_enabled: false,
      update: function (p: any) { Object.assign(this, p) },
      toObject: function () { const { update, toObject, ...rest } = this as any; return rest },
    }
    const repo = makeRepo(existing)
    const uc = new SaveMetaIntegrationUseCase(repo, encrypt)
    await uc.execute({ orgId: 'org_mg', test_event_code: '', stape_endpoint: null })

    const o = savedObject(repo)
    expect(o.test_event_code).toBeNull()   // '' limpia
    expect(o.stape_endpoint).toBeNull()    // null limpia
    expect(o.pixel_id).toBe('123')         // undefined preserva
    expect(o.gtm_container_id).toBe('GTM-1')
  })

  it('el placeholder ******** no pisa el token guardado', async () => {
    const existing = {
      access_token_encrypted: 'enc(viejo)',
      ga4_api_secret_encrypted: null,
      pixel_id: '123',
      stape_endpoint: null,
      gtm_container_id: null,
      test_event_code: null,
      ga4_measurement_id: null,
      enabled: true,
      ga4_enabled: false,
      update: function (p: any) { Object.assign(this, p) },
      toObject: function () { const { update, toObject, ...rest } = this as any; return rest },
    }
    const repo = makeRepo(existing)
    const uc = new SaveMetaIntegrationUseCase(repo, encrypt)
    await uc.execute({ orgId: 'org_mg', access_token: '********' })
    expect(savedObject(repo).access_token_encrypted).toBe('enc(viejo)')
  })

  it("access_token '' limpia el token guardado", async () => {
    const existing = {
      access_token_encrypted: 'enc(viejo)',
      ga4_api_secret_encrypted: null,
      pixel_id: '123',
      stape_endpoint: null,
      gtm_container_id: null,
      test_event_code: null,
      ga4_measurement_id: null,
      enabled: true,
      ga4_enabled: false,
      update: function (p: any) { Object.assign(this, p) },
      toObject: function () { const { update, toObject, ...rest } = this as any; return rest },
    }
    const repo = makeRepo(existing)
    const uc = new SaveMetaIntegrationUseCase(repo, encrypt)
    await uc.execute({ orgId: 'org_mg', access_token: '' })
    expect(savedObject(repo).access_token_encrypted).toBeNull()
  })
})
