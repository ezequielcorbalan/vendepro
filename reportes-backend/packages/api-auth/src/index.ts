import { Hono } from 'hono'
import { corsMiddleware, errorHandler } from '@vendepro/infrastructure'
import { D1UserRepository, JwtAuthService, CryptoIdGenerator } from '@vendepro/infrastructure'
import { LoginUseCase, CreateUserUseCase, ChangePasswordUseCase } from '@vendepro/core'

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
  // JWT is stateless — client deletes the token
  return c.json({ success: true })
})

export default app
