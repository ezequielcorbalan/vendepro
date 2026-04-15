import { describe, it, expect, vi, beforeEach } from 'vitest'
import { D1UserRepository, JwtAuthService } from '@vendepro/infrastructure'

vi.mock('@vendepro/infrastructure', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    corsMiddleware: async (_c: any, next: any) => next(),
    D1UserRepository: vi.fn().mockImplementation(() => ({
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      findByOrg: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    })),
    JwtAuthService: vi.fn().mockImplementation(() => ({
      hashPassword: vi.fn().mockResolvedValue('hashed_new'),
      verifyPassword: vi.fn().mockResolvedValue(false),
      createToken: vi.fn().mockResolvedValue('jwt-token'),
      verifyToken: vi.fn().mockResolvedValue(null),
    })),
    CryptoIdGenerator: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockReturnValue('test-id'),
    })),
  }
})

// ── helpers ──────────────────────────────────────────────────
const mockUser = {
  id: 'user-1',
  email: 'agent@mg.com',
  full_name: 'Test Agent',
  org_id: 'org_mg',
  password_hash: 'hashed',
  role: 'agent',
  phone: null,
  photo_url: null,
  active: 1,
  updatePassword: vi.fn(),
  toObject: vi.fn().mockReturnValue({
    id: 'user-1', email: 'agent@mg.com', full_name: 'Test Agent', org_id: 'org_mg',
    password_hash: 'hashed', role: 'agent', phone: null, photo_url: null, active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
  }),
}

function makeMockDb(tokenRow: any = null) {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(tokenRow),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }),
  }
}

const ENV_BASE = { JWT_SECRET: 'test-secret', EMBLUE_API_KEY: 'test-api-key' }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
  mockUser.updatePassword.mockClear()
})

// ── existing routes ───────────────────────────────────────────
describe('POST /login', () => {
  it('returns 401 for unknown user', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@mg.com', password: 'wrong' }),
    }, { DB: makeMockDb(), ...ENV_BASE })
    expect(res.status).toBe(401)
    const body = await res.json() as any
    expect(body.error).toBeDefined()
  })
})

describe('POST /logout', () => {
  it('returns success', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/logout', { method: 'POST' }, { DB: makeMockDb(), ...ENV_BASE })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
  })
})

// ── POST /forgot-password ─────────────────────────────────────
describe('POST /forgot-password', () => {
  it('returns 200 success when email not found (never reveals existence)', async () => {
    vi.mocked(D1UserRepository).mockImplementation(() => ({
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      findByOrg: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }))
    const { default: app } = await import('../src/index')
    const res = await app.request('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notexists@mg.com' }),
    }, { DB: makeMockDb(), ...ENV_BASE })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
  })

  it('returns 200 success when email exists, inserts token and calls emBlue', async () => {
    vi.mocked(D1UserRepository).mockImplementation(() => ({
      findByEmail: vi.fn().mockResolvedValue(mockUser as any),
      findById: vi.fn().mockResolvedValue(mockUser as any),
      findByOrg: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }))
    const mockDb = makeMockDb()
    const { default: app } = await import('../src/index')
    const res = await app.request('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'agent@mg.com' }),
    }, { DB: mockDb, ...ENV_BASE })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO password_reset_tokens'))
    expect(fetch).toHaveBeenCalledWith(
      'https://api.embluemail.com/v2.3/send',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns 200 even if emBlue call fails (graceful degradation)', async () => {
    vi.mocked(D1UserRepository).mockImplementation(() => ({
      findByEmail: vi.fn().mockResolvedValue(mockUser as any),
      findById: vi.fn().mockResolvedValue(null),
      findByOrg: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const { default: app } = await import('../src/index')
    const res = await app.request('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'agent@mg.com' }),
    }, { DB: makeMockDb(), ...ENV_BASE })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
  })
})

// ── POST /reset-password ──────────────────────────────────────
describe('POST /reset-password', () => {
  const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
  const pastDate   = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)

  const validTokenRow = {
    token: 'validtoken123',
    user_id: 'user-1',
    org_id: 'org_mg',
    expires_at: futureDate,
    used: 0,
  }

  it('returns 400 when token not found', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid', password: 'newpass123' }),
    }, { DB: makeMockDb(null), ...ENV_BASE })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('Token inválido')
  })

  it('returns 400 when token already used', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'usedtoken', password: 'newpass123' }),
    }, { DB: makeMockDb({ ...validTokenRow, used: 1 }), ...ENV_BASE })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('Token ya utilizado')
  })

  it('returns 400 when token expired', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'expiredtoken', password: 'newpass123' }),
    }, { DB: makeMockDb({ ...validTokenRow, expires_at: pastDate }), ...ENV_BASE })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('Token expirado')
  })

  it('returns 400 when password too short', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'validtoken123', password: 'short' }),
    }, { DB: makeMockDb(validTokenRow), ...ENV_BASE })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('La contraseña debe tener al menos 8 caracteres')
  })

  it('returns 200 on valid token + password, saves new hash and marks token used', async () => {
    vi.mocked(D1UserRepository).mockImplementation(() => ({
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(mockUser as any),
      findByOrg: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }))
    const mockDb = makeMockDb(validTokenRow)
    const { default: app } = await import('../src/index')
    const res = await app.request('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'validtoken123', password: 'newpass123' }),
    }, { DB: mockDb, ...ENV_BASE })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE password_reset_tokens SET used = 1'))
    expect(mockUser.updatePassword).toHaveBeenCalledWith('hashed_new')
  })
})
