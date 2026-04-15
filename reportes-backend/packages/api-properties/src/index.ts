import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1PropertyRepository, JwtAuthService, CryptoIdGenerator, R2StorageService } from '@reportes/infrastructure'
import { GetPropertiesUseCase, CreatePropertyUseCase, UpdatePropertyPriceUseCase, UpdatePropertyStatusUseCase } from '@reportes/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.use('/properties*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})
app.use('/reports*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})
app.use('/upload-photo', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

// ── PROPERTIES ─────────────────────────────────────────────────
app.get('/properties', async (c) => {
  const { status, agent_id, neighborhood, property_type } = c.req.query()
  const repo = new D1PropertyRepository(c.env.DB)
  const useCase = new GetPropertiesUseCase(repo)
  const items = await useCase.execute(c.get('orgId'), { status, agent_id, neighborhood, property_type })
  return c.json(items.map(p => p.toObject()))
})

app.post('/properties', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1PropertyRepository(c.env.DB)
  const useCase = new CreatePropertyUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ ...body, org_id: c.get('orgId'), agent_id: body.agent_id || c.get('userId') })
  return c.json(result, 201)
})

app.get('/properties/:id', async (c) => {
  const repo = new D1PropertyRepository(c.env.DB)
  const prop = await repo.findById(c.req.param('id'), c.get('orgId'))
  if (!prop) return c.json({ error: 'Not found' }, 404)
  return c.json(prop.toObject())
})

app.put('/properties/:id/price', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1PropertyRepository(c.env.DB)
  const useCase = new UpdatePropertyPriceUseCase(repo)
  await useCase.execute({ propertyId: c.req.param('id'), orgId: c.get('orgId'), newPrice: body.price, currency: body.currency || 'USD' })
  return c.json({ success: true })
})

app.put('/properties/:id/status', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1PropertyRepository(c.env.DB)
  const useCase = new UpdatePropertyStatusUseCase(repo)
  await useCase.execute({ propertyId: c.req.param('id'), orgId: c.get('orgId'), newStatus: body.status })
  return c.json({ success: true })
})

app.delete('/properties/:id', async (c) => {
  const repo = new D1PropertyRepository(c.env.DB)
  await repo.delete(c.req.param('id'), c.get('orgId'))
  return c.json({ success: true })
})

// ── PHOTO UPLOAD ───────────────────────────────────────────────
app.post('/upload-photo', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'No file' }, 400)
  const buffer = await file.arrayBuffer()
  const key = `photos/${c.get('orgId')}/${Date.now()}-${file.name}`
  const storage = new R2StorageService(c.env.R2, c.env.R2_PUBLIC_URL)
  const url = await storage.upload(key, buffer, file.type)
  return c.json({ url, key })
})

app.get('/photo/*', async (c) => {
  const key = c.req.path.replace('/photo/', '')
  const object = await c.env.R2.get(key)
  if (!object) return c.json({ error: 'Not found' }, 404)
  const headers = new Headers()
  object.httpMetadata?.contentType && headers.set('Content-Type', object.httpMetadata.contentType)
  headers.set('Cache-Control', 'public, max-age=31536000')
  return new Response(object.body, { headers })
})

// ── REPORTS (stub) ─────────────────────────────────────────────
app.get('/reports', async (c) => {
  const { property_id } = c.req.query()
  const db = c.env.DB
  let rows: any[]
  if (property_id) {
    rows = (await db.prepare('SELECT * FROM reports WHERE property_id = ? AND org_id = ? ORDER BY created_at DESC').bind(property_id, c.get('orgId')).all()).results
  } else {
    rows = (await db.prepare('SELECT r.*, p.address FROM reports r LEFT JOIN properties p ON r.property_id = p.id WHERE r.org_id = ? ORDER BY r.created_at DESC').bind(c.get('orgId')).all()).results
  }
  return c.json(rows)
})

export default app
