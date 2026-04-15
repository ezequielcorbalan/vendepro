# Registro Público de Organizaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cualquier inmobiliaria se registre en VendéPro de forma autónoma, creando su organización y un usuario admin en un solo flujo de 3 pasos.

**Architecture:** Un endpoint atómico `POST /register-org` en `api-auth` crea org + usuario con dos `save()` secuenciales. El wizard de 3 pasos es puramente UX — el submit real ocurre al terminar el paso 2. El paso 3 (personalización) es opcional y usa el endpoint `PUT /admin/org-settings` existente post-login.

**Tech Stack:** Hono (Cloudflare Workers), D1 (SQLite), Vitest, Next.js 15 (App Router), Tailwind CSS, `apiFetch` helper interno.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `vendepro-backend/migrations/008_register_org_indexes.sql` |
| Crear | `vendepro-backend/packages/core/src/domain/errors/conflict-error.ts` |
| Modificar | `vendepro-backend/packages/core/src/domain/errors/index.ts` |
| Crear | `vendepro-backend/packages/core/src/application/ports/repositories/organization-repository.ts` |
| Modificar | `vendepro-backend/packages/core/src/application/ports/repositories/index.ts` |
| Crear | `vendepro-backend/packages/infrastructure/src/repositories/d1-organization-repository.ts` |
| Modificar | `vendepro-backend/packages/infrastructure/src/repositories/index.ts` |
| Crear | `vendepro-backend/packages/core/src/application/use-cases/auth/register-with-org.ts` |
| Crear | `vendepro-backend/packages/core/tests/use-cases/auth/register-with-org.test.ts` |
| Modificar | `vendepro-backend/packages/api-auth/src/index.ts` |
| Crear | `vendepro-frontend/src/app/(auth)/register/page.tsx` |
| Modificar | `vendepro-frontend/src/app/(auth)/login/page.tsx` |
| Modificar | `vendepro-frontend/src/app/(dashboard)/configuracion/page.tsx` |

---

## Task 1: Migración SQL e índices

**Files:**
- Create: `vendepro-backend/migrations/008_register_org_indexes.sql`

- [ ] **Step 1: Crear el archivo de migración**

La tabla `organizations` ya tiene `slug TEXT UNIQUE NOT NULL` (migration 003) — no se toca.
Solo agregamos el índice de usuarios por org que falta.

```sql
-- migrations/008_register_org_indexes.sql
-- Índice para búsquedas de usuarios por org (mejora queries de /admin/agents y /register-org)
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
```

- [ ] **Step 2: Verificar que el archivo existe**

```bash
cat vendepro-backend/migrations/008_register_org_indexes.sql
```

Expected: una línea con el `CREATE INDEX IF NOT EXISTS idx_users_org`.

- [ ] **Step 3: Commit**

```bash
cd vendepro-backend
git add migrations/008_register_org_indexes.sql
git commit -m "feat(db): índices para organizaciones y usuarios por org"
```

---

## Task 2: ConflictError — nuevo error de dominio

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/errors/conflict-error.ts`
- Modify: `vendepro-backend/packages/core/src/domain/errors/index.ts`

- [ ] **Step 1: Crear `conflict-error.ts`**

```typescript
// packages/core/src/domain/errors/conflict-error.ts
import { DomainError } from './domain-error'

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT_ERROR'
  readonly httpStatus = 409

  constructor(message: string) {
    super(message)
  }
}
```

- [ ] **Step 2: Exportar desde el index de errors**

Agregar al final de `vendepro-backend/packages/core/src/domain/errors/index.ts`:

```typescript
export { ConflictError } from './conflict-error'
```

El archivo completo queda:

```typescript
export { DomainError } from './domain-error'
export { NotFoundError } from './not-found'
export { UnauthorizedError } from './unauthorized'
export { ForbiddenError } from './forbidden'
export { ValidationError } from './validation-error'
export { ConflictError } from './conflict-error'
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/domain/errors/conflict-error.ts \
        packages/core/src/domain/errors/index.ts
git commit -m "feat(core): ConflictError para slugs y emails duplicados"
```

---

## Task 3: OrganizationRepository — port e implementación D1

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/organization-repository.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/index.ts`
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-organization-repository.ts`
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/index.ts`

- [ ] **Step 1: Crear el port `OrganizationRepository`**

```typescript
// packages/core/src/application/ports/repositories/organization-repository.ts
import type { Organization } from '../../../domain/entities/organization'

export interface OrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>
  save(org: Organization): Promise<void>
}
```

- [ ] **Step 2: Exportar desde el index de repositories**

Agregar al final de `vendepro-backend/packages/core/src/application/ports/repositories/index.ts`:

```typescript
export * from './organization-repository'
```

- [ ] **Step 3: Crear `D1OrganizationRepository`**

```typescript
// packages/infrastructure/src/repositories/d1-organization-repository.ts
import { Organization } from '@vendepro/core'
import type { OrganizationRepository } from '@vendepro/core'

export class D1OrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: D1Database) {}

  async findBySlug(slug: string): Promise<Organization | null> {
    const row = await this.db
      .prepare('SELECT * FROM organizations WHERE slug = ?')
      .bind(slug)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(org: Organization): Promise<void> {
    const o = org.toObject()
    await this.db.prepare(`
      INSERT INTO organizations (id, name, slug, logo_url, brand_color, brand_accent_color, canva_template_id, canva_report_template_id, owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, slug=excluded.slug, logo_url=excluded.logo_url,
        brand_color=excluded.brand_color, brand_accent_color=excluded.brand_accent_color,
        canva_template_id=excluded.canva_template_id, canva_report_template_id=excluded.canva_report_template_id,
        owner_id=excluded.owner_id
    `).bind(
      o.id, o.name, o.slug, o.logo_url, o.brand_color, o.brand_accent_color,
      o.canva_template_id, o.canva_report_template_id, o.owner_id, o.created_at
    ).run()
  }

  private toEntity(row: any): Organization {
    return Organization.create({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo_url: row.logo_url ?? null,
      brand_color: row.brand_color ?? '#ff007c',
      brand_accent_color: row.brand_accent_color ?? null,
      canva_template_id: row.canva_template_id ?? null,
      canva_report_template_id: row.canva_report_template_id ?? null,
      owner_id: row.owner_id ?? null,
      created_at: row.created_at,
    })
  }
}
```

- [ ] **Step 4: Exportar desde el index de infrastructure repositories**

Agregar al final de `vendepro-backend/packages/infrastructure/src/repositories/index.ts`:

```typescript
export * from './d1-organization-repository'
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/application/ports/repositories/organization-repository.ts \
        packages/core/src/application/ports/repositories/index.ts \
        packages/infrastructure/src/repositories/d1-organization-repository.ts \
        packages/infrastructure/src/repositories/index.ts
git commit -m "feat(core/infra): OrganizationRepository port + D1 implementation"
```

---

## Task 4: RegisterWithOrgUseCase + tests

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/auth/register-with-org.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/auth/register-with-org.test.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// packages/core/tests/use-cases/auth/register-with-org.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RegisterWithOrgUseCase } from '../../../src/application/use-cases/auth/register-with-org'
import { ConflictError } from '../../../src/domain/errors/conflict-error'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockOrgRepo = {
  findBySlug: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
}
const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}
const mockAuthService = {
  hashPassword: vi.fn().mockResolvedValue('hashed_pass'),
  verifyPassword: vi.fn(),
  createToken: vi.fn().mockResolvedValue('jwt-token'),
  verifyToken: vi.fn(),
}
const mockIdGen = {
  generate: vi.fn()
    .mockReturnValueOnce('aabbccdd11223344aabbccdd11223344') // org id
    .mockReturnValueOnce('eeff00112233445566778899aabbccdd'), // user id
}

const validInput = {
  org_name: 'Genta Inmobiliaria',
  org_slug: 'genta-inmobiliaria',
  admin_name: 'Marcela Genta',
  email: 'marcela@genta.com',
  password: 'password123',
  logo_url: null,
  brand_color: '#ff007c',
}

describe('RegisterWithOrgUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrgRepo.findBySlug.mockResolvedValue(null)
    mockUserRepo.findByEmail.mockResolvedValue(null)
    mockIdGen.generate
      .mockReturnValueOnce('aabbccdd11223344aabbccdd11223344')
      .mockReturnValueOnce('eeff00112233445566778899aabbccdd')
  })

  it('crea org y admin, retorna token y datos', async () => {
    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    const result = await useCase.execute(validInput)

    expect(result.token).toBe('jwt-token')
    expect(result.user.email).toBe('marcela@genta.com')
    expect(result.user.role).toBe('admin')
    expect(result.org.slug).toBe('genta-inmobiliaria')
    expect(mockOrgRepo.save).toHaveBeenCalledOnce()
    expect(mockUserRepo.save).toHaveBeenCalledOnce()
  })

  it('lanza ConflictError si el slug ya existe', async () => {
    mockOrgRepo.findBySlug.mockResolvedValue({ id: 'existing-org' })

    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError)
  })

  it('lanza ConflictError si el email ya existe', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ id: 'existing-user' })

    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError)
  })

  it('sanitiza el slug a solo a-z 0-9 guiones', async () => {
    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    const result = await useCase.execute({ ...validInput, org_slug: 'Genta & Asoc!!' })

    expect(result.org.slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('lanza ValidationError si la contraseña tiene menos de 8 caracteres', async () => {
    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    await expect(useCase.execute({ ...validInput, password: 'short' })).rejects.toThrow(ValidationError)
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

```bash
cd vendepro-backend
npm test -- --filter @vendepro/core --reporter verbose 2>&1 | grep -A5 "register-with-org"
```

Expected: FAIL — `RegisterWithOrgUseCase` no existe aún.

- [ ] **Step 3: Implementar `RegisterWithOrgUseCase`**

```typescript
// packages/core/src/application/use-cases/auth/register-with-org.ts
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { AuthService } from '../../ports/services/auth-service'
import type { IdGenerator } from '../../ports/id-generator'
import { Organization } from '../../../domain/entities/organization'
import { User } from '../../../domain/entities/user'
import { ConflictError } from '../../../domain/errors/conflict-error'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface RegisterWithOrgInput {
  org_name: string
  org_slug: string
  admin_name: string
  email: string
  password: string
  logo_url?: string | null
  brand_color?: string | null
}

export interface RegisterWithOrgOutput {
  token: string
  user: { id: string; email: string; name: string; role: string; org_id: string }
  org: { id: string; name: string; slug: string }
}

export class RegisterWithOrgUseCase {
  constructor(
    private readonly orgRepo: OrganizationRepository,
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: RegisterWithOrgInput): Promise<RegisterWithOrgOutput> {
    if (input.password.length < 8) {
      throw new ValidationError('La contraseña debe tener al menos 8 caracteres')
    }

    const slug = this.sanitizeSlug(input.org_slug)

    const existingOrg = await this.orgRepo.findBySlug(slug)
    if (existingOrg) throw new ConflictError('El nombre de inmobiliaria ya está en uso')

    const existingUser = await this.userRepo.findByEmail(input.email)
    if (existingUser) throw new ConflictError('Ya existe una cuenta con ese email')

    const orgId = 'org_' + this.idGen.generate()
    const userId = this.idGen.generate()

    const org = Organization.create({
      id: orgId,
      name: input.org_name.trim(),
      slug,
      logo_url: input.logo_url ?? null,
      brand_color: input.brand_color ?? '#ff007c',
      brand_accent_color: null,
      canva_template_id: null,
      canva_report_template_id: null,
      owner_id: userId,
    })

    const passwordHash = await this.authService.hashPassword(input.password)
    const user = User.create({
      id: userId,
      email: input.email,
      password_hash: passwordHash,
      full_name: input.admin_name.trim(),
      role: 'admin',
      org_id: orgId,
      phone: null,
      photo_url: null,
      active: 1,
    })

    await this.orgRepo.save(org)
    await this.userRepo.save(user)

    const token = await this.authService.createToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      org_id: user.org_id,
    })

    return {
      token,
      user: { id: user.id, email: user.email, name: user.full_name, role: user.role, org_id: user.org_id! },
      org: { id: org.id, name: org.name, slug: org.slug },
    }
  }

  private sanitizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
}
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

```bash
cd vendepro-backend
npm test -- --filter @vendepro/core --reporter verbose 2>&1 | grep -A5 "register-with-org"
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/application/use-cases/auth/register-with-org.ts \
        packages/core/tests/use-cases/auth/register-with-org.test.ts
git commit -m "feat(core): RegisterWithOrgUseCase con tests"
```

---

## Task 5: Endpoints en api-auth

**Files:**
- Modify: `vendepro-backend/packages/api-auth/src/index.ts`

- [ ] **Step 1: Agregar los dos endpoints al final, antes del `export default app`**

El archivo `vendepro-backend/packages/api-auth/src/index.ts` completo queda:

```typescript
import { Hono } from 'hono'
import { corsMiddleware, errorHandler } from '@vendepro/infrastructure'
import { D1UserRepository, D1OrganizationRepository, JwtAuthService, CryptoIdGenerator } from '@vendepro/infrastructure'
import { LoginUseCase, CreateUserUseCase, ChangePasswordUseCase, RegisterWithOrgUseCase } from '@vendepro/core'

type Env = {
  DB: D1Database
  JWT_SECRET: string
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

// ── REGISTRO PÚBLICO DE ORGANIZACIONES ──────────────────────────

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

export default app
```

- [ ] **Step 2: Verificar que el build del worker no da errores de TypeScript**

```bash
cd vendepro-backend
npx tsc --noEmit -p packages/api-auth/tsconfig.json 2>&1 | head -30
```

Expected: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add packages/api-auth/src/index.ts
git commit -m "feat(api-auth): endpoints POST /register-org y GET /check-slug"
```

---

## Task 6: Frontend — página de registro en 3 pasos

**Files:**
- Create: `vendepro-frontend/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Crear la página del wizard**

```tsx
// vendepro-frontend/src/app/(auth)/register/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { apiFetch, setToken } from '@/lib/api'
import { setCurrentUser } from '@/lib/auth'

type Step = 1 | 2 | 3

interface FormData {
  org_name: string
  org_slug: string
  admin_name: string
  email: string
  password: string
  logo_url: string
  brand_color: string
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState<FormData>({
    org_name: '',
    org_slug: '',
    admin_name: '',
    email: '',
    password: '',
    logo_url: '',
    brand_color: '#ff007c',
  })

  function update(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Auto-generar slug desde org_name
  useEffect(() => {
    if (step !== 1) return
    const slug = generateSlug(form.org_name)
    setForm(prev => ({ ...prev, org_slug: slug }))
  }, [form.org_name])

  // Validar disponibilidad del slug con debounce
  useEffect(() => {
    if (!form.org_slug) { setSlugStatus('idle'); return }
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current)
    setSlugStatus('checking')
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('auth', `/check-slug?slug=${encodeURIComponent(form.org_slug)}`)
        const data = (await res.json()) as any
        // Sincronizar slug sanitizado que devuelve el servidor
        if (data.slug) setForm(prev => ({ ...prev, org_slug: data.slug }))
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)
  }, [form.org_slug])

  function handleStep1Next(e: React.FormEvent) {
    e.preventDefault()
    if (slugStatus === 'taken') { setError('El nombre de inmobiliaria ya está en uso'); return }
    setError('')
    setStep(2)
  }

  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('auth', '/register-org', {
        method: 'POST',
        body: JSON.stringify({
          org_name: form.org_name,
          org_slug: form.org_slug,
          admin_name: form.admin_name,
          email: form.email,
          password: form.password,
          logo_url: null,
          brand_color: '#ff007c',
        }),
      })
      const data = (await res.json()) as any
      if (!res.ok) {
        if (data.code === 'CONFLICT_ERROR' && data.error?.includes('inmobiliaria')) {
          setError(data.error)
          setStep(1)
        } else {
          setError(data.error || 'Error al crear la cuenta')
        }
        setLoading(false)
        return
      }
      // Login automático
      setToken(data.token)
      document.cookie = `vendepro_token=${data.token}; path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
      setCurrentUser({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.name ?? '',
        name: data.user.name ?? '',
        role: data.user.role,
        org_id: data.user.org_id,
        phone: null,
        photo_url: null,
      })
      setStep(3)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    }
    setLoading(false)
  }

  async function handleStep3Save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await apiFetch('admin', '/org-settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.org_name,
          logo_url: form.logo_url || null,
          brand_color: form.brand_color,
          canva_template_id: null,
          canva_report_template_id: null,
        }),
      })
    } catch {
      // No bloqueamos el acceso si falla la personalización
    }
    router.push('/dashboard')
    router.refresh()
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  const STEPS = ['Tu inmobiliaria', 'Tu cuenta', 'Personalización']

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="VendéPro" className="h-12 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-gray-800">Registrá tu inmobiliaria</h1>
        </div>

        {/* Barra de progreso */}
        <div className="flex items-center mb-8">
          {STEPS.map((label, i) => {
            const n = (i + 1) as Step
            const isActive = step === n
            const isDone = step > n
            return (
              <div key={n} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                    isDone ? 'bg-[#ff007c] border-[#ff007c] text-white' :
                    isActive ? 'border-[#ff007c] text-[#ff007c]' :
                    'border-gray-300 text-gray-400'
                  }`}>
                    {isDone ? '✓' : n}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-[#ff007c] font-medium' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 transition-colors ${step > n ? 'bg-[#ff007c]' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        {/* PASO 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la inmobiliaria *</label>
              <input
                type="text"
                value={form.org_name}
                onChange={e => update('org_name', e.target.value)}
                required
                placeholder="Ej: Genta Inmobiliaria"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identificador único (URL)
                <span className="text-gray-400 font-normal ml-1 text-xs">— se usa en links públicos</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.org_slug}
                  onChange={e => update('org_slug', e.target.value)}
                  required
                  placeholder="genta-inmobiliaria"
                  className={`${inputClass} pr-8`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  {slugStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {slugStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
              {slugStatus === 'available' && <p className="text-xs text-green-600 mt-1">Disponible</p>}
              {slugStatus === 'taken' && <p className="text-xs text-red-600 mt-1">Ya está en uso, elegí otro</p>}
            </div>
            <button
              type="submit"
              disabled={slugStatus === 'taken' || slugStatus === 'checking' || !form.org_name}
              className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* PASO 2 */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre completo *</label>
              <input
                type="text"
                value={form.admin_name}
                onChange={e => update('admin_name', e.target.value)}
                required
                placeholder="Marcela Genta"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                placeholder="marcela@genta.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
              <input
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className={inputClass}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep(1); setError('') }}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50"
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Creando...' : 'Crear cuenta'}
              </button>
            </div>
          </form>
        )}

        {/* PASO 3 — Personalización opcional */}
        {step === 3 && (
          <form onSubmit={handleStep3Save} className="space-y-4">
            <p className="text-sm text-gray-500 -mt-2 mb-2">
              Podés configurar esto ahora o después desde <strong>Configuración</strong>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL del logo</label>
              <input
                type="url"
                value={form.logo_url}
                onChange={e => update('logo_url', e.target.value)}
                placeholder="https://tuinmobiliaria.com/logo.png"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color de marca</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={e => update('brand_color', e.target.value)}
                  className="h-10 w-16 rounded border border-gray-300 cursor-pointer p-1"
                />
                <span className="text-sm text-gray-500 font-mono">{form.brand_color}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar y entrar
            </button>
            <button
              type="button"
              onClick={() => { router.push('/dashboard'); router.refresh() }}
              className="w-full text-gray-500 text-sm py-2 hover:text-gray-700"
            >
              Saltar por ahora
            </button>
          </form>
        )}

        {step < 3 && (
          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-[#ff007c] hover:underline font-medium">
              Ingresá acá
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd vendepro-frontend
git add src/app/\(auth\)/register/page.tsx
git commit -m "feat(frontend): página de registro de organizaciones en 3 pasos"
```

---

## Task 7: Link "Registrate" en la página de login

**Files:**
- Modify: `vendepro-frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Agregar el import de Link y el link al final del form**

Agregar el import de `Link` (si no está):

```typescript
import Link from 'next/link'
```

Luego, debajo del botón de submit y antes del cierre del `<div className="bg-white ...">`, agregar:

```tsx
<p className="text-center text-sm text-gray-500 mt-4">
  ¿No tenés cuenta?{' '}
  <Link href="/register" className="text-[#ff007c] hover:underline font-medium">
    Registrá tu inmobiliaria
  </Link>
</p>
```

El bloque final del return queda:

```tsx
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        ¿No tenés cuenta?{' '}
        <Link href="/register" className="text-[#ff007c] hover:underline font-medium">
          Registrá tu inmobiliaria
        </Link>
      </p>
    </div>
  </div>
```

- [ ] **Step 2: Verificar que el archivo compila sin errores**

```bash
cd vendepro-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "feat(frontend): link a /register en la pantalla de login"
```

---

## Task 8: Campo slug editable en Configuración

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/configuracion/page.tsx`

- [ ] **Step 1: Leer el archivo actual para entender su estructura**

Leer `vendepro-frontend/src/app/(dashboard)/configuracion/page.tsx` completo antes de editar.

- [ ] **Step 2: Agregar estado y lógica de slug**

Agregar estas importaciones al principio si no existen:
```typescript
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
```

Agregar estado del slug dentro del componente, junto a los otros estados:
```typescript
const [slug, setSlug] = useState('')
const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

Agregar `useRef` al import de React si no está: `import { useState, useEffect, useRef } from 'react'`

Cargar el slug desde org-settings en el `useEffect` existente. Donde se lee `data.org`, agregar:
```typescript
if (data.slug) setSlug(data.slug)
// o si la respuesta es directa (sin .org wrapper):
if (data.slug) setSlug(data.slug)
```

Agregar `useEffect` para validar slug con debounce (pegar después de los otros useEffects):
```typescript
useEffect(() => {
  if (!slug) { setSlugStatus('idle'); return }
  if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current)
  setSlugStatus('checking')
  slugDebounceRef.current = setTimeout(async () => {
    try {
      const res = await apiFetch('auth', `/check-slug?slug=${encodeURIComponent(slug)}`)
      const data = (await res.json()) as any
      if (data.slug) setSlug(data.slug)
      setSlugStatus(data.available ? 'available' : 'taken')
    } catch {
      setSlugStatus('idle')
    }
  }, 500)
}, [slug])
```

Incluir `slug` en el payload del `handleSave`:
```typescript
// Dentro de handleSave, en el body del PUT /org-settings:
body: JSON.stringify({ ...settings, slug }),
```

- [ ] **Step 3: Agregar el campo slug en el JSX**

Agregar antes o después del campo de nombre de la org (buscar el campo `name` en el form):

```tsx
{/* Slug */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Identificador único (URL)
    <span className="text-gray-400 font-normal ml-1 text-xs">— aparece en links públicos</span>
  </label>
  <div className="relative">
    <input
      type="text"
      value={slug}
      onChange={e => setSlug(e.target.value)}
      placeholder="mi-inmobiliaria"
      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c] pr-8"
    />
    <div className="absolute right-3 top-1/2 -translate-y-1/2">
      {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
      {slugStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
      {slugStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
    </div>
  </div>
  {slugStatus === 'taken' && <p className="text-xs text-red-600 mt-1">Ya está en uso</p>}
</div>
```

- [ ] **Step 4: Verificar que el archivo compila sin errores**

```bash
cd vendepro-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/configuracion/page.tsx
git commit -m "feat(frontend): campo slug editable en configuración de org"
```

---

## Task 9: Actualizar api-admin para aceptar slug en org-settings

**Files:**
- Modify: `vendepro-backend/packages/api-admin/src/index.ts`

El endpoint `PUT /org-settings` actual no incluye `slug` en el UPDATE. Hay que agregarlo.

- [ ] **Step 1: Verificar el slug no provoca conflicto al actualizar**

Agregar validación al endpoint. Reemplazar el handler `app.put('/org-settings', ...)` con:

```typescript
app.put('/org-settings', async (c) => {
  const body = (await c.req.json()) as any
  const { name, logo_url, brand_color, canva_template_id, canva_report_template_id, slug } = body

  if (slug) {
    // Verificar que el slug no esté tomado por otra org
    const existing = await c.env.DB.prepare(
      'SELECT id FROM organizations WHERE slug = ? AND id != ?'
    ).bind(slug, c.get('orgId')).first()
    if (existing) return c.json({ error: 'El identificador ya está en uso', code: 'CONFLICT_ERROR' }, 409)

    await c.env.DB.prepare(`
      UPDATE organizations SET name=?, logo_url=?, brand_color=?, canva_template_id=?, canva_report_template_id=?, slug=? WHERE id=?
    `).bind(name, logo_url, brand_color, canva_template_id, canva_report_template_id, slug, c.get('orgId')).run()
  } else {
    await c.env.DB.prepare(`
      UPDATE organizations SET name=?, logo_url=?, brand_color=?, canva_template_id=?, canva_report_template_id=? WHERE id=?
    `).bind(name, logo_url, brand_color, canva_template_id, canva_report_template_id, c.get('orgId')).run()
  }

  return c.json({ success: true })
})
```

- [ ] **Step 2: Verificar tipos**

```bash
cd vendepro-backend
npx tsc --noEmit -p packages/api-admin/tsconfig.json 2>&1 | head -20
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add packages/api-admin/src/index.ts
git commit -m "feat(api-admin): soporte para actualizar slug en org-settings"
```

---

## Task 10: Test de integración manual y verificación final

- [ ] **Step 1: Correr todos los tests del backend**

```bash
cd vendepro-backend
npm test 2>&1 | tail -20
```

Expected: todos los tests PASS, sin errores.

- [ ] **Step 2: Build del frontend sin errores**

```bash
cd vendepro-frontend
npx next build 2>&1 | tail -20
```

Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 3: Verificar el flujo completo en dev**

Levantar el servidor de desarrollo:
```bash
cd vendepro-frontend
npx next dev
```

Navegar a `http://localhost:3000/register` y verificar:
- [ ] Paso 1: al escribir el nombre de la org se genera el slug automáticamente
- [ ] Paso 1: el indicador de disponibilidad aparece después de 500ms
- [ ] Paso 1: botón "Continuar" deshabilitado mientras el slug está siendo verificado
- [ ] Paso 2: al crear la cuenta, redirige al paso 3
- [ ] Paso 3: "Saltar por ahora" lleva al dashboard
- [ ] Login: aparece el link "Registrá tu inmobiliaria"

- [ ] **Step 4: Commit final**

```bash
cd vendepro-backend && git add -A && git commit -m "feat: registro público de organizaciones completo"
cd ../vendepro-frontend && git add -A && git commit -m "feat(frontend): flujo de registro completo"
```
