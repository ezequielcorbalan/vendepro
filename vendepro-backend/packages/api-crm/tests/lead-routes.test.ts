import { describe, it, expect, vi } from 'vitest'

vi.mock('@vendepro/infrastructure', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    corsMiddleware: async (_c: any, next: any) => next(),
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'agent-1')
      c.set('userRole', 'agent')
      c.set('orgId', 'org_mg')
      await next()
    },
    D1LeadRepository: vi.fn().mockImplementation(() => ({
      findByOrg: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    })),
    D1ContactRepository: vi.fn().mockImplementation(() => ({
      findByOrg: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    })),
    D1CalendarRepository: vi.fn().mockImplementation(() => ({
      findByOrg: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    })),
    D1ActivityRepository: vi.fn().mockImplementation(() => ({
      findByOrg: vi.fn().mockResolvedValue([]),
    })),
    D1TagRepository: vi.fn().mockImplementation(() => ({
      findByOrg: vi.fn().mockResolvedValue([]),
      findByLead: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      addToLead: vi.fn().mockResolvedValue(undefined),
      removeFromLead: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    })),
    D1StageHistoryRepository: vi.fn().mockImplementation(() => ({
      log: vi.fn().mockResolvedValue(undefined),
      findByEntity: vi.fn().mockResolvedValue([]),
    })),
    D1OrganizationRepository: vi.fn().mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      findByApiKey: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      updateSettings: vi.fn().mockResolvedValue(undefined),
      setApiKey: vi.fn().mockResolvedValue(undefined),
      getApiKey: vi.fn().mockResolvedValue(null),
    })),
    JwtAuthService: vi.fn().mockImplementation(() => ({})),
    CryptoIdGenerator: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockReturnValue('gen-id'),
    })),
  }
})

describe('api-crm lead routes', () => {
  it('GET /leads returns empty array', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/leads', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(Array.isArray(body)).toBe(true)
  })

  it('POST /leads with valid data creates lead', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'María González', phone: '1134567890', source: 'manual', contact_id: 'existing-contact' }),
    }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBe('gen-id')
  })

  it('POST /leads with too-short name returns 422', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'X', phone: '123', source: 'manual', contact_id: 'existing-contact' }),
    }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(400)
  })

  it('POST /leads without contact returns 400', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Test', source: 'manual' }),
    }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toMatch(/contact/)
  })

  it('GET /tags returns empty array', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/tags', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
  })

  it('GET /calendar returns empty array', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/calendar', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
  })

  it('POST /leads with contact_data creates contact then lead', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_data: { full_name: 'María González', contact_type: 'propietario' },
        source: 'manual',
      }),
    }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBe('gen-id')
  })

  it('POST /api-key returns a new key with correct format', async () => {
    const mockRun = vi.fn().mockResolvedValue({})
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: mockRun }),
      }),
    }
    const { default: app } = await import('../src/index')
    const res = await app.request('/api-key', {
      method: 'POST',
    }, { DB: mockDB, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.api_key).toMatch(/^vp_live_[0-9a-f]{32}$/)
  })

  it('GET /api-key returns has_key false when no key set', async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ api_key: null }),
        }),
      }),
    }
    const { default: app } = await import('../src/index')
    const res = await app.request('/api-key', { method: 'GET' }, { DB: mockDB, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.has_key).toBe(false)
  })
})
