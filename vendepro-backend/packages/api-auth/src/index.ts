import { Hono } from 'hono'
import { corsMiddleware, errorHandler } from '@vendepro/infrastructure'
import { D1UserRepository, D1OrganizationRepository, D1PasswordResetTokenRepository, JwtAuthService, CryptoIdGenerator, EmBlueEmailService } from '@vendepro/infrastructure'
import { LoginUseCase, CreateUserUseCase, ChangePasswordUseCase, RegisterWithOrgUseCase, RequestPasswordResetUseCase, CompletePasswordResetUseCase } from '@vendepro/core'

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
    const useCase = new RequestPasswordResetUseCase(
      new D1UserRepository(c.env.DB),
      new D1PasswordResetTokenRepository(c.env.DB),
      new EmBlueEmailService(c.env.EMBLUE_API_KEY),
      new CryptoIdGenerator(),
    )
    await useCase.execute({
      email,
      appBaseUrl: 'https://app.vendepro.com.ar',
      fromEmail: 'noreply@vendepro.com.ar',
      fromName: 'VendéPro CRM',
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

  const useCase = new CompletePasswordResetUseCase(
    new D1PasswordResetTokenRepository(c.env.DB),
    new D1UserRepository(c.env.DB),
    new JwtAuthService(c.env.JWT_SECRET),
  )
  await useCase.execute({ token, newPassword: password })
  return c.json({ success: true })
})

export default app
