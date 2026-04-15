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

  // Check expiry — D1 stores datetime as 'YYYY-MM-DD HH:MM:SS' (UTC), convert to ISO for parsing
  const expiresAt = new Date(row.expires_at.replace(' ', 'T') + 'Z')
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
