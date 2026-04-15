# Forgot Password + emBlue Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar flujo completo de recuperación de contraseña (forgot/reset) con envío de email vía emBlue API v2.3, y agregar el link "¿Olvidaste tu contraseña?" en el login.

**Architecture:** Dos nuevos endpoints en `api-auth` Worker (`POST /forgot-password` y `POST /reset-password`) que usan una tabla D1 `password_reset_tokens` para tokens de un solo uso con expiración de 1 hora. El email se envía vía `POST https://api.embluemail.com/v2.3/send` con `Authorization: Bearer <EMBLUE_API_KEY>`. El frontend tiene dos nuevas páginas `(auth)/forgot-password` y `(auth)/reset-password` que siguen el mismo estilo que login/register.

**Tech Stack:** Hono + Cloudflare Workers + D1 (SQLite) + emBlue API v2.3 + Next.js 15 App Router + Tailwind CSS

---

## File Map

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| CREAR | `vendepro-backend/migrations_v2/002_password_reset_tokens.sql` | Tabla de tokens de reset |
| MODIFICAR | `vendepro-backend/packages/api-auth/src/index.ts` | Agregar 2 endpoints nuevos + tipo `EMBLUE_API_KEY` |
| MODIFICAR | `vendepro-backend/packages/api-auth/tests/routes.test.ts` | Tests para los nuevos endpoints |
| MODIFICAR | `vendepro-frontend/src/app/(auth)/login/page.tsx` | Agregar link "¿Olvidaste tu contraseña?" |
| CREAR | `vendepro-frontend/src/app/(auth)/forgot-password/page.tsx` | Página para solicitar reset |
| CREAR | `vendepro-frontend/src/app/(auth)/reset-password/page.tsx` | Página para ingresar nueva contraseña |

---

## Task 1: Migración de base de datos

**Files:**
- Create: `vendepro-backend/migrations_v2/002_password_reset_tokens.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- 002_password_reset_tokens.sql
-- Tokens de un solo uso para recuperación de contraseña (expiran en 1 hora)

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  org_id     TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Commit**

```bash
cd C:/proyectos/vendepro
git add vendepro-backend/migrations_v2/002_password_reset_tokens.sql
git commit -m "feat(db): tabla password_reset_tokens para flujo de recuperación"
```

---

## Task 2: Backend — nuevos endpoints en api-auth

**Files:**
- Modify: `vendepro-backend/packages/api-auth/src/index.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar el contenido completo de `vendepro-backend/packages/api-auth/tests/routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DomainError } from '@vendepro/core'
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

  it('returns 200 success when email exists and inserts token + sends email', async () => {
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
    // DB insert was called
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO password_reset_tokens'))
    // emBlue API was called
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
    // token marked as used
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE password_reset_tokens SET used = 1'))
    // user.updatePassword was called (via mockUser.updatePassword)
    expect(mockUser.updatePassword).toHaveBeenCalledWith('hashed_new')
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd C:/proyectos/vendepro/vendepro-backend/packages/api-auth
npx vitest run
```

Esperado: tests de `/forgot-password` y `/reset-password` fallan con "Cannot find route" o similar.

- [ ] **Step 3: Implementar los nuevos endpoints**

Reemplazar el contenido completo de `vendepro-backend/packages/api-auth/src/index.ts`:

```typescript
import { Hono } from 'hono'
import { corsMiddleware, errorHandler } from '@vendepro/infrastructure'
import { D1UserRepository, D1OrganizationRepository, JwtAuthService, CryptoIdGenerator } from '@vendepro/infrastructure'
import { LoginUseCase, CreateUserUseCase, ChangePasswordUseCase, RegisterWithOrgUseCase } from '@vendepro/core'

type Env = {
  DB: D1Database
  JWT_SECRET: string
  EMBLUE_API_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.post('/login', async (c) => {
  const body = (await c.req.json()) as any
  const db = c.env.DB
  const userRepo = new D1UserRepository(db)
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const useCase = new LoginUseCase(userRepo, authService)
  const result = await useCase.execute({ email: body.email, password: body.password })
  return c.json(result)
})

app.post('/register', async (c) => {
  const body = (await c.req.json()) as any
  const db = c.env.DB
  const userRepo = new D1UserRepository(db)
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const idGen = new CryptoIdGenerator()
  const useCase = new CreateUserUseCase(userRepo, authService, idGen)
  const result = await useCase.execute({
    email: body.email,
    password: body.password,
    name: body.name || body.full_name,
    role: body.role || 'agent',
    org_id: body.org_id || 'org_mg',
    phone: body.phone ?? null,
  })
  return c.json(result, 201)
})

app.post('/password', async (c) => {
  const body = (await c.req.json()) as any
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const payload = await authService.verifyToken(token)
  if (!payload) return c.json({ error: 'Invalid token' }, 401)

  const userRepo = new D1UserRepository(c.env.DB)
  const useCase = new ChangePasswordUseCase(userRepo, authService)
  await useCase.execute({
    userId: payload.sub as string,
    orgId: payload.org_id as string,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
  })
  return c.json({ success: true })
})

app.post('/logout', (c) => {
  return c.json({ success: true })
})

app.get('/check-slug', async (c) => {
  const slug = c.req.query('slug') ?? ''
  const sanitized = slug
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!sanitized) return c.json({ available: false, slug: '' })

  const orgRepo = new D1OrganizationRepository(c.env.DB)
  const existing = await orgRepo.findBySlug(sanitized)
  return c.json({ available: !existing, slug: sanitized })
})

app.post('/register-org', async (c) => {
  const body = (await c.req.json()) as any
  const orgRepo = new D1OrganizationRepository(c.env.DB)
  const userRepo = new D1UserRepository(c.env.DB)
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const idGen = new CryptoIdGenerator()
  const useCase = new RegisterWithOrgUseCase(orgRepo, userRepo, authService, idGen)
  const result = await useCase.execute({
    org_name: body.org_name,
    org_slug: body.org_slug,
    admin_name: body.admin_name,
    email: body.email,
    password: body.password,
    logo_url: body.logo_url ?? null,
    brand_color: body.brand_color ?? '#ff007c',
  })
  return c.json(result, 201)
})

// ── Password Reset ─────────────────────────────────────────────

app.post('/forgot-password', async (c) => {
  const body = (await c.req.json()) as any
  const email = (body.email as string | undefined)?.toLowerCase().trim()

  // Always return success — never reveal if an email is registered
  if (!email) return c.json({ success: true })

  try {
    const db = c.env.DB
    const userRepo = new D1UserRepository(db)
    const user = await userRepo.findByEmail(email)

    if (!user) return c.json({ success: true })

    // Generate secure 64-char hex token (32 bytes entropy)
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const resetToken = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')

    // Store token with 1-hour expiry
    await db.prepare(
      `INSERT INTO password_reset_tokens (token, user_id, org_id, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))`
    ).bind(resetToken, user.id, user.org_id ?? 'org_mg').run()

    // Send email via emBlue API v2.3
    // NOTE: Ajustar el body si el formato de emBlue difiere — está todo aquí en un solo lugar
    const resetLink = `https://app.vendepro.com.ar/reset-password?token=${resetToken}`
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;">
        <h2 style="color:#ff007c;margin-bottom:8px;">Recuperá tu contraseña</h2>
        <p style="color:#333;">Hola <strong>${user.full_name}</strong>,</p>
        <p style="color:#555;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>VendéPro CRM</strong>.</p>
        <p style="margin:28px 0;">
          <a href="${resetLink}"
             style="background:#ff007c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
            Recuperar contraseña
          </a>
        </p>
        <p style="color:#888;font-size:13px;">Este link es válido por <strong>1 hora</strong>. Si no solicitaste este cambio, podés ignorar este email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:12px;">O copiá este link en tu navegador:</p>
        <p style="color:#aaa;font-size:11px;word-break:break-all;">${resetLink}</p>
      </div>
    `

    await fetch('https://api.embluemail.com/v2.3/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.EMBLUE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: 'noreply@vendepro.com.ar', name: 'VendéPro CRM' },
        to: [{ email: user.email, name: user.full_name }],
        subject: 'Recuperá tu contraseña — VendéPro',
        html: emailHtml,
        text: `Hola ${user.full_name}, ingresá al siguiente link para recuperar tu contraseña: ${resetLink} (válido por 1 hora)`,
      }),
    })
  } catch (err) {
    // Log error but never block the user or reveal internal state
    console.error('[forgot-password]', err)
  }

  return c.json({ success: true })
})

app.post('/reset-password', async (c) => {
  const body = (await c.req.json()) as any
  const { token, password } = body as { token?: string; password?: string }

  if (!token || !password) return c.json({ error: 'Token y contraseña son requeridos' }, 400)
  if (password.length < 8) return c.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)

  const db = c.env.DB

  // Find token record
  const row = await db.prepare(
    `SELECT * FROM password_reset_tokens WHERE token = ?`
  ).bind(token).first() as any

  if (!row) return c.json({ error: 'Token inválido' }, 400)
  if (row.used === 1) return c.json({ error: 'Token ya utilizado' }, 400)

  // Check expiry (D1 stores datetime as 'YYYY-MM-DD HH:MM:SS', add Z to parse as UTC)
  const expiresAt = new Date(row.expires_at.includes('T') ? row.expires_at : row.expires_at + 'Z')
  if (expiresAt < new Date()) return c.json({ error: 'Token expirado' }, 400)

  // Update user password
  const userRepo = new D1UserRepository(db)
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const user = await userRepo.findById(row.user_id, row.org_id)
  if (!user) return c.json({ error: 'Token inválido' }, 400)

  const newHash = await authService.hashPassword(password)
  user.updatePassword(newHash)
  await userRepo.save(user)

  // Mark token as used (one-time use)
  await db.prepare(`UPDATE password_reset_tokens SET used = 1 WHERE token = ?`).bind(token).run()

  return c.json({ success: true })
})

export default app
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
cd C:/proyectos/vendepro/vendepro-backend/packages/api-auth
npx vitest run
```

Esperado: todos los tests pasan (incluyendo los 8 nuevos).

- [ ] **Step 5: Commit**

```bash
cd C:/proyectos/vendepro
git add vendepro-backend/packages/api-auth/src/index.ts \
        vendepro-backend/packages/api-auth/tests/routes.test.ts
git commit -m "feat(api-auth): endpoints POST /forgot-password y /reset-password con emBlue"
```

---

## Task 3: Frontend — link en login page

**Files:**
- Modify: `vendepro-frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Agregar el link "¿Olvidaste tu contraseña?" entre el botón y el footer**

Localizar en `vendepro-frontend/src/app/(auth)/login/page.tsx` el bloque del botón submit (líneas ~100-106) y agregar el link después:

```tsx
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-[#ff007c] transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
```

El bloque `<p>` del footer ya existente (¿No tenés cuenta?) queda intacto abajo.

- [ ] **Step 2: Commit**

```bash
cd C:/proyectos/vendepro
git add vendepro-frontend/src/app/(auth)/login/page.tsx
git commit -m "feat(login): agregar link olvidaste tu contraseña"
```

---

## Task 4: Frontend — página /forgot-password

**Files:**
- Create: `vendepro-frontend/src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await apiFetch('auth', '/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="VendéPro" className="h-12 sm:h-16 mx-auto mb-3" />
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Recuperar contraseña</h1>
          <p className="text-gray-500 text-sm mt-1">
            {sent
              ? 'Revisá tu bandeja de entrada'
              : 'Ingresá tu email y te enviamos las instrucciones'}
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 text-green-700 text-sm p-4 rounded-lg">
              Si el email está registrado, vas a recibir un mensaje con las instrucciones para recuperar tu contraseña.
            </div>
            <Link
              href="/login"
              className="block w-full text-center text-[#ff007c] hover:underline font-medium text-sm mt-2"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
                placeholder="tu@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar instrucciones'}
            </button>

            <p className="text-center text-sm text-gray-500">
              <Link href="/login" className="text-[#ff007c] hover:underline font-medium">
                Volver al inicio de sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/proyectos/vendepro
git add vendepro-frontend/src/app/(auth)/forgot-password/page.tsx
git commit -m "feat(frontend): página /forgot-password para solicitar reset de contraseña"
```

---

## Task 5: Frontend — página /reset-password

**Files:**
- Create: `vendepro-frontend/src/app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) setError('Link inválido. Solicitá un nuevo link de recuperación.')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }

    setLoading(true)
    setError('')

    try {
      const res = await apiFetch('auth', '/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })

      const data = (await res.json()) as any

      if (!res.ok) {
        setError(data.error ?? 'Error al restablecer la contraseña')
        return
      }

      setSuccess(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="bg-green-50 text-green-700 text-sm p-4 rounded-lg">
          ¡Contraseña actualizada correctamente! Ya podés ingresar con tu nueva contraseña.
        </div>
        <Link
          href="/login"
          className="block w-full text-center bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          Ir al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
          {error}
          {(error.includes('inválido') || error.includes('expirado')) && (
            <span>
              {' '}
              <Link href="/forgot-password" className="underline font-medium">
                Solicitá un nuevo link
              </Link>
            </span>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={!token}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c] disabled:bg-gray-100"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Repetir contraseña</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          disabled={!token}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c] disabled:bg-gray-100"
          placeholder="Repetí la contraseña"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !token}
        className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Guardar contraseña'}
      </button>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-[#ff007c] hover:underline font-medium">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="VendéPro" className="h-12 sm:h-16 mx-auto mb-3" />
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Nueva contraseña</h1>
          <p className="text-gray-500 text-sm mt-1">Elegí una contraseña segura para tu cuenta</p>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-gray-400">Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
```

> **Nota:** `useSearchParams()` requiere `<Suspense>` en Next.js 15 App Router. El componente interno `ResetPasswordForm` usa el hook; el default export lo envuelve en `<Suspense>`.

- [ ] **Step 2: Commit**

```bash
cd C:/proyectos/vendepro
git add vendepro-frontend/src/app/(auth)/reset-password/page.tsx
git commit -m "feat(frontend): página /reset-password para ingresar nueva contraseña"
```

---

## Task 6: Configurar EMBLUE_API_KEY como secret del Worker

- [ ] **Step 1: Agregar al `.dev.vars` local (para desarrollo — NO commitear)**

Abrir `vendepro-backend/packages/api-auth/.dev.vars` y agregar:

```
JWT_SECRET=vendepro-jwt-secret-2026-mg
EMBLUE_API_KEY=<tu_api_key_de_emblue>
```

- [ ] **Step 2: Verificar que `.dev.vars` está en `.gitignore`**

```bash
cd C:/proyectos/vendepro
grep -r "\.dev\.vars" .gitignore vendepro-backend/.gitignore 2>/dev/null || echo "VERIFICAR — asegurarse que .dev.vars no se commitea"
```

Si no aparece en `.gitignore`, agregar:
```bash
echo "*.dev.vars\n.dev.vars" >> vendepro-backend/.gitignore
git add vendepro-backend/.gitignore
git commit -m "chore: ignorar .dev.vars en gitignore"
```

- [ ] **Step 3: (Cuando se vaya a producción) Agregar el secret en Cloudflare**

```bash
cd C:/proyectos/vendepro/vendepro-backend/packages/api-auth
npx wrangler secret put EMBLUE_API_KEY
# Pegar el valor cuando lo pida — nunca queda en código ni en git
```

---

## Task 7: Verificación final

- [ ] **Step 1: Correr todos los tests del backend**

```bash
cd C:/proyectos/vendepro/vendepro-backend/packages/api-auth
npx vitest run
```

Esperado: todos los tests pasan (0 failures).

- [ ] **Step 2: Build del frontend para verificar tipos**

```bash
cd C:/proyectos/vendepro/vendepro-frontend
npx next build 2>&1 | tail -20
```

Esperado: build exitoso sin errores de TypeScript.

- [ ] **Step 3: Commit final si hay cambios pendientes**

```bash
cd C:/proyectos/vendepro
git status
# Si hay cambios: git add -p && git commit -m "chore: ajustes finales forgot-password"
```

---

## Notas importantes para la implementación

### Formato de emBlue
El body del `fetch` a `https://api.embluemail.com/v2.3/send` usa el formato más común de APIs transaccionales modernas. Si la respuesta de emBlue devuelve error, verificar en los logs del Worker (`wrangler tail`) el status code y ajustar los campos `from`, `to`, `html` según la documentación real. El envío está en un solo lugar: `api-auth/src/index.ts`, función del endpoint `/forgot-password`.

### URL de reset en producción
El link de reset hardcodea `https://app.vendepro.com.ar`. Si hay un dominio diferente o se quiere que sea configurable, moverlo a una variable de entorno `FRONTEND_URL` en el Worker.

### Aplicar la migración en producción
La tabla `password_reset_tokens` debe crearse en la DB de Cloudflare D1. Ejecutar via Cloudflare Dashboard → D1 → vendepro-db → Console, o via:
```bash
npx wrangler d1 execute vendepro-db --file=migrations_v2/002_password_reset_tokens.sql
```
