import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1ReservationRepository, D1StageHistoryRepository, JwtAuthService, CryptoIdGenerator, fireMarketingEvent } from '@vendepro/infrastructure'
import {
  GetReservationsUseCase, CreateReservationUseCase, AdvanceReservationStageUseCase, computeReservationMilestones,
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
  const { stage, agent_id, property_id } = c.req.query()
  const repo = new D1ReservationRepository(c.env.DB)
  const useCase = new GetReservationsUseCase(repo)
  const items = await useCase.execute(c.get('orgId'), { stage, agent_id, property_id })
  // Los hitos salen calculados de core: la ficha y el portal del propietario
  // muestran exactamente lo mismo.
  const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return c.json(items.map(r => ({
    ...r.toObject(),
    milestones: computeReservationMilestones({
      stage: r.stage,
      accepted_at: r.accepted_at,
      acceptance_deadline: r.acceptance_deadline,
      boleto_date: r.boleto_date,
      escritura_date: r.escritura_date,
      delivery_date: r.delivery_date,
    }, today),
  })))
})

app.post('/reservations', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ReservationRepository(c.env.DB)
  const historyRepo = new D1StageHistoryRepository(c.env.DB)
  const useCase = new CreateReservationUseCase(repo, historyRepo, new CryptoIdGenerator())
  const orgId = c.get('orgId')
  const reservationAgentId = body.agent_id || c.get('userId')
  const result = await useCase.execute({ ...body, org_id: orgId, agent_id: reservationAgentId })
  // Hook marketing: evento `reservation_created`.
  const mk = await fireMarketingEvent(c.env, {
    orgId,
    agentId: reservationAgentId,
    eventKey: 'reservation_created',
    entityType: 'reservation',
    entityId: result.id,
    userData: {
      full_name: body.buyer_name ?? null,
      estimated_value: typeof body.offer_amount === 'number' ? body.offer_amount : null,
    },
    customData: {
      property_address: body.property_address ?? null,
      offer_currency: body.offer_currency ?? 'USD',
    },
    actionSource: 'system_generated',
  })
  return c.json({ ...result, marketing: mk ?? null }, 201)
})

app.put('/reservations/stage', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ReservationRepository(c.env.DB)
  const historyRepo = new D1StageHistoryRepository(c.env.DB)
  const useCase = new AdvanceReservationStageUseCase(repo, historyRepo)
  const orgId = c.get('orgId')
  await useCase.execute({ reservationId: body.id, orgId, newStage: body.stage, changedBy: c.get('userId') })
  // El evento dispara bajo la config del agente dueño de la reserva.
  const stageReservation = await repo.findById(body.id, orgId).catch(() => null)
  const reservationAgentId = (stageReservation?.toObject?.() ?? (stageReservation as any))?.agent_id ?? c.get('userId')
  // Hook marketing: evento por stage de reserva (configurable por mapping).
  // Mapeos recomendados: 'reservada'→InitiateCheckout, 'escriturada'→Purchase.
  const mk = await fireMarketingEvent(c.env, {
    orgId,
    agentId: reservationAgentId,
    eventKey: `reservation_${body.stage}`,
    entityType: 'reservation',
    entityId: body.id,
    actionSource: 'system_generated',
    ga4ClientId: body.ga4_client_id ?? null,
  })
  return c.json({ success: true, marketing: mk ?? null })
})

app.put('/reservations', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ReservationRepository(c.env.DB)
  const res = await repo.findById(body.id, c.get('orgId'))
  if (!res) return c.json({ error: 'Not found' }, 404)
  // Sólo datos y fechas: la etapa cambia por /reservations/stage (deja historial)
  // y el org/agente no se tocan desde acá.
  const EDITABLE = [
    'property_address', 'buyer_name', 'seller_name', 'offer_amount', 'offer_currency', 'reservation_date', 'notes',
    'acceptance_deadline', 'accepted_at', 'boleto_date', 'escritura_date', 'delivery_date',
  ] as const
  const data: Record<string, unknown> = {}
  for (const key of EDITABLE) if (key in body) data[key] = body[key] === '' ? null : body[key]
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
