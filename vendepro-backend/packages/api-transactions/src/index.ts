import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1ReservationRepository, D1StageHistoryRepository, JwtAuthService, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  GetReservationsUseCase, CreateReservationUseCase, AdvanceReservationStageUseCase,
} from '@vendepro/core'

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

export default app
