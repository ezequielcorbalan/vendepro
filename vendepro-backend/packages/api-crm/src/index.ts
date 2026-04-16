import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1LeadRepository, D1ContactRepository, D1CalendarRepository, D1ActivityRepository, D1TagRepository, D1StageHistoryRepository, JwtAuthService, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  GetLeadsUseCase, CreateLeadUseCase, UpdateLeadUseCase, DeleteLeadUseCase, AdvanceLeadStageUseCase,
  GetContactsUseCase, CreateContactUseCase, DeleteContactUseCase,
  GetCalendarEventsUseCase, CreateCalendarEventUseCase, ToggleEventCompleteUseCase, RescheduleEventUseCase,
  Tag,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

// Apply auth to all routes
app.use('*', async (c, next) => {
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  return createAuthMiddleware(authService)(c, next)
})

// ── LEADS ──────────────────────────────────────────────────────
app.get('/leads', async (c) => {
  const { stage, agent_id, search } = c.req.query()
  const repo = new D1LeadRepository(c.env.DB)
  const useCase = new GetLeadsUseCase(repo)
  const leads = await useCase.execute(c.get('orgId'), { stage, agent_id, search })
  return c.json(leads.map(l => l.toObject?.() ?? l))
})

app.post('/leads', async (c) => {
  const body = (await c.req.json()) as any

  let contact_id: string | undefined = body.contact_id

  // If contact_data provided, create the contact first
  if (!contact_id && body.contact_data) {
    const contactRepo = new D1ContactRepository(c.env.DB)
    const createContact = new CreateContactUseCase(contactRepo, new CryptoIdGenerator())
    const contactResult = await createContact.execute({
      ...body.contact_data,
      org_id: c.get('orgId'),
      agent_id: c.get('userId'),
    })
    contact_id = contactResult.id
  }

  const repo = new D1LeadRepository(c.env.DB)
  const useCase = new CreateLeadUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({
    ...body,
    contact_id: contact_id ?? null,
    org_id: c.get('orgId'),
    assigned_to: body.assigned_to || c.get('userId'),
  })
  return c.json(result, 201)
})

app.put('/leads', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1LeadRepository(c.env.DB)
  const useCase = new UpdateLeadUseCase(repo)
  await useCase.execute({ ...body, orgId: c.get('orgId') })
  return c.json({ success: true })
})

app.delete('/leads', async (c) => {
  const { id } = c.req.query()
  const repo = new D1LeadRepository(c.env.DB)
  const useCase = new DeleteLeadUseCase(repo)
  await useCase.execute(id, c.get('orgId'))
  return c.json({ success: true })
})

app.post('/leads/stage', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1LeadRepository(c.env.DB)
  const calRepo = new D1CalendarRepository(c.env.DB)
  const historyRepo = new D1StageHistoryRepository(c.env.DB)
  const useCase = new AdvanceLeadStageUseCase(repo, calRepo, historyRepo, new CryptoIdGenerator())
  const result = await useCase.execute({ leadId: body.id, orgId: c.get('orgId'), newStage: body.stage, changedBy: c.get('userId'), notes: body.notes })
  return c.json(result)
})

// ── CONTACTS ───────────────────────────────────────────────────
app.get('/contacts', async (c) => {
  const { search, agent_id } = c.req.query()
  const repo = new D1ContactRepository(c.env.DB)
  const useCase = new GetContactsUseCase(repo)
  const contacts = await useCase.execute(c.get('orgId'), { search, agent_id })
  return c.json(contacts.map(ct => ct.toObject?.() ?? ct))
})

app.post('/contacts', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ContactRepository(c.env.DB)
  const useCase = new CreateContactUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ ...body, org_id: c.get('orgId'), agent_id: body.agent_id || c.get('userId') })
  return c.json(result, 201)
})

app.delete('/contacts', async (c) => {
  const { id } = c.req.query()
  const repo = new D1ContactRepository(c.env.DB)
  const useCase = new DeleteContactUseCase(repo)
  await useCase.execute(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── CALENDAR ───────────────────────────────────────────────────
app.get('/calendar', async (c) => {
  const { agent_id, start, end, event_type } = c.req.query()
  const repo = new D1CalendarRepository(c.env.DB)
  const useCase = new GetCalendarEventsUseCase(repo)
  const events = await useCase.execute(c.get('orgId'), { agent_id, start, end, event_type })
  return c.json(events.map(e => e.toObject()))
})

app.post('/calendar', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1CalendarRepository(c.env.DB)
  const useCase = new CreateCalendarEventUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ ...body, org_id: c.get('orgId'), agent_id: body.agent_id || c.get('userId') })
  return c.json(result, 201)
})

app.put('/calendar/complete', async (c) => {
  const { id } = c.req.query()
  const repo = new D1CalendarRepository(c.env.DB)
  const useCase = new ToggleEventCompleteUseCase(repo)
  const result = await useCase.execute(id, c.get('orgId'))
  return c.json(result)
})

app.put('/calendar/reschedule', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1CalendarRepository(c.env.DB)
  const useCase = new RescheduleEventUseCase(repo)
  await useCase.execute({ eventId: body.id, orgId: c.get('orgId'), startAt: body.start_at, endAt: body.end_at })
  return c.json({ success: true })
})

app.delete('/calendar', async (c) => {
  const { id } = c.req.query()
  const repo = new D1CalendarRepository(c.env.DB)
  await repo.delete(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── ACTIVITIES ─────────────────────────────────────────────────
app.get('/activities', async (c) => {
  const { agent_id, lead_id, contact_id, property_id } = c.req.query()
  const repo = new D1ActivityRepository(c.env.DB)
  const activities = await repo.findByOrg(c.get('orgId'), { agent_id, lead_id, contact_id, property_id })
  return c.json(activities.map(a => a.toObject?.() ?? a))
})

// ── TAGS ───────────────────────────────────────────────────────
app.get('/tags', async (c) => {
  const repo = new D1TagRepository(c.env.DB)
  const tags = await repo.findByOrg(c.get('orgId'))
  return c.json(tags.map(t => t.toObject?.() ?? t))
})

app.get('/lead-tags', async (c) => {
  const { lead_id } = c.req.query()
  const repo = new D1TagRepository(c.env.DB)
  const tags = await repo.findByLead(lead_id, c.get('orgId'))
  return c.json(tags.map(t => t.toObject?.() ?? t))
})

app.post('/lead-tags', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1TagRepository(c.env.DB)
  await repo.addToLead(body.lead_id, body.tag_id, c.get('orgId'))
  return c.json({ success: true })
})

app.delete('/lead-tags', async (c) => {
  const { lead_id, tag_id } = c.req.query()
  const repo = new D1TagRepository(c.env.DB)
  await repo.removeFromLead(lead_id, tag_id, c.get('orgId'))
  return c.json({ success: true })
})

app.post('/tags', async (c) => {
  const body = (await c.req.json()) as any
  if (!body.name || typeof body.name !== 'string') {
    return c.json({ error: 'name is required' }, 400)
  }
  const repo = new D1TagRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()
  const id = idGen.generate()
  const tag = Tag.create({
    id,
    org_id: c.get('orgId'),
    name: body.name,
    color: body.color || '#6366f1',
    is_default: 0,
  })
  await repo.save(tag)
  return c.json({ id }, 201)
})

app.delete('/tags', async (c) => {
  const { id } = c.req.query()
  if (!id) return c.json({ error: 'id is required' }, 400)
  const repo = new D1TagRepository(c.env.DB)
  await repo.delete(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── API KEY ────────────────────────────────────────────────────
app.post('/api-key', async (c) => {
  const orgId = c.get('orgId')
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const hex = Array.from(bytes).map((b: number) => b.toString(16).padStart(2, '0')).join('')
  const apiKey = `vp_live_${hex}`
  await c.env.DB.prepare('UPDATE organizations SET api_key = ? WHERE id = ?').bind(apiKey, orgId).run()
  return c.json({ api_key: apiKey })
})

app.get('/api-key', async (c) => {
  const orgId = c.get('orgId')
  const row = await c.env.DB.prepare('SELECT api_key FROM organizations WHERE id = ?').bind(orgId).first() as any
  if (!row?.api_key) return c.json({ has_key: false, api_key_masked: null })
  const key = row.api_key as string
  const masked = `vp_live_••••••••••••${key.slice(-4)}`
  return c.json({ has_key: true, api_key_masked: masked })
})

// ── STAGE HISTORY ──────────────────────────────────────────────
app.get('/stage-history', async (c) => {
  const { entity_type, entity_id } = c.req.query()
  if (!entity_id) return c.json({ error: 'entity_id is required' }, 400)
  const repo = new D1StageHistoryRepository(c.env.DB)
  const history = await repo.findByEntity(entity_type as any, entity_id as any, c.get('orgId'))
  return c.json(history.map((h: any) => h.toObject?.() ?? h))
})

export default app
