import { describe, it, expect, vi } from 'vitest'
import { DomainError } from '@reportes/core'

// Mock only what we need to mock — use real errorHandler so DomainError → HTTP status mapping works
vi.mock('@reportes/infrastructure', async (importOriginal) => {
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
      hashPassword: vi.fn().mockResolvedValue('hashed'),
      verifyPassword: vi.fn().mockResolvedValue(false),
      createToken: vi.fn().mockResolvedValue('jwt-token'),
      verifyToken: vi.fn().mockResolvedValue(null),
    })),
    CryptoIdGenerator: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockReturnValue('test-id'),
    })),
  }
})

describe('api-auth routes', () => {
  it('POST /login returns 401 for unknown user', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@mg.com', password: 'wrong' }),
    }, { DB: {}, JWT_SECRET: 'test-secret' })

    expect(res.status).toBe(401)
    const body = await res.json() as any
    expect(body.error).toBeDefined()
  })

  it('POST /logout returns success', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/logout', { method: 'POST' }, { DB: {}, JWT_SECRET: 'test-secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
  })
})
