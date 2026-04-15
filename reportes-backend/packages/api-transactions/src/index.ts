import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1ReservationRepository, D1StageHistoryRepository, JwtAuthService, CryptoIdGenerator } from '@reportes/infrastructure'
import {
  GetReservationsUseCase, CreateReservationUseCase, AdvanceReservationStageUseCase,
} from '@reportes/core'

type Env = { DB: D1Database; JWT_SECRET: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.use('*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

// ── RESERVATIONS ───────────────────────────────────────────────
app.get('/reservations', async (c) => {
  const { stage, agent_id } = c.req.query()
  const repo = new D1ReservationRepository(c.env.DB)
  const useCase = new GetReservationsUseCase(repo)
  const items = await useCase.execute(c.get('orgId'), { stage, agent_id })
  return c.json(items.map(r => r.toObject()))
})

app.post('/reservations', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ReservationRepository(c.env.DB)
  const historyRepo = new D1StageHistoryRepository(c.env.DB)
  const useCase = new CreateReservationUseCase(repo, historyRepo, new CryptoIdGenerator())
  const result = await useCase.execute({ ...body, org_id: c.get('orgId'), agent_id: body.agent_id || c.get('userId') })
  return c.json(result, 201)
})

app.put('/reservations/stage', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ReservationRepository(c.env.DB)
  const historyRepo = new D1StageHistoryRepository(c.env.DB)
  const useCase = new AdvanceReservationStageUseCase(repo, historyRepo)
  await useCase.execute({ reservationId: body.id, orgId: c.get('orgId'), newStage: body.stage, changedBy: c.get('userId') })
  return c.json({ success: true })
})

app.put('/reservations', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ReservationRepository(c.env.DB)
  const res = await repo.findById(body.id, c.get('orgId'))
  if (!res) return c.json({ error: 'Not found' }, 404)
  const { id, org_id, ...data } = body
  res.update(data)
  await repo.save(res)
  return c.json({ success: true })
})

app.delete('/reservations', async (c) => {
  const { id } = c.req.query()
  const repo = new D1ReservationRepository(c.env.DB)
  await repo.delete(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── SOLD PROPERTIES (simple record) ───────────────────────────
app.post('/sold-properties', async (c) => {
  const body = (await c.req.json()) as any
  const db = c.env.DB
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.prepare(`
    INSERT INTO sold_properties (id, org_id, property_id, buyer_name, seller_name, agent_id,
      sale_price, sale_currency, sale_date, commission, notes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
  `).bind(id, c.get('orgId'), body.property_id, body.buyer_name, body.seller_name,
    body.agent_id || c.get('userId'), body.sale_price, body.sale_currency || 'USD',
    body.sale_date, body.commission, body.notes).run()
  return c.json({ id }, 201)
})

export default app
