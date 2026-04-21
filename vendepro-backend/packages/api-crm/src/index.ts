import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1LeadRepository, D1ContactRepository, D1CalendarRepository, D1ActivityRepository, D1TagRepository, D1StageHistoryRepository, D1OrganizationRepository, JwtAuthService, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  GetLeadsUseCase, UpdateLeadUseCase, DeleteLeadUseCase, AdvanceLeadStageUseCase,
  GetContactsUseCase, CreateContactUseCase, DeleteContactUseCase,
  GetCalendarEventsUseCase, CreateCalendarEventUseCase, ToggleEventCompleteUseCase, RescheduleEventUseCase,
  CreateLeadWithContactUseCase, GetContactDetailUseCase, CreateTagUseCase,
  GenerateOrgApiKeyUseCase, GetOrgApiKeyUseCase,
} from '@vendepro/core'
import {
  CreateLandingFromTemplateUseCase, UpdateLandingBlocksUseCase, AddBlockUseCase,
  RemoveBlockUseCase, ReorderBlocksUseCase, ToggleBlockVisibilityUseCase,
  RequestPublishUseCase, PublishLandingUseCase, RejectPublishRequestUseCase,
  ArchiveLandingUseCase, UnarchiveLandingUseCase, RollbackLandingUseCase,
  ListTemplatesUseCase, CreateTemplateUseCase, UpdateTemplateUseCase,
  ListLandingsUseCase, GetLandingUseCase, UpdateLandingMetadataUseCase,
  GetLandingAnalyticsUseCase,
} from '@vendepro/core'
import {
  D1LandingRepository, D1LandingTemplateRepository,
  D1LandingVersionRepository, D1LandingEventRepository,
} from '@vendepro/infrastructure'

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
  const leadRepo = new D1LeadRepository(c.env.DB)
  const contactRepo = new D1ContactRepository(c.env.DB)
  const useCase = new CreateLeadWithContactUseCase(leadRepo, contactRepo, new CryptoIdGenerator())
  const result = await useCase.execute({
    ...body,
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

app.get('/contacts/:id', async (c) => {
  const id = c.req.param('id')
  const repo = new D1ContactRepository(c.env.DB)
  const useCase = new GetContactDetailUseCase(repo)
  const detail = await useCase.execute(id, c.get('orgId'))
  if (!detail) return c.json({ error: 'Contacto no encontrado' }, 404)
  return c.json({
    ...detail.contact.toObject(),
    leads: detail.leads,
    properties: detail.properties,
  })
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
  const repo = new D1TagRepository(c.env.DB)
  const useCase = new CreateTagUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ org_id: c.get('orgId'), name: body.name, color: body.color })
  return c.json(result, 201)
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
  const repo = new D1OrganizationRepository(c.env.DB)
  const useCase = new GenerateOrgApiKeyUseCase(repo)
  const result = await useCase.execute(c.get('orgId'))
  return c.json(result)
})

app.get('/api-key', async (c) => {
  const repo = new D1OrganizationRepository(c.env.DB)
  const useCase = new GetOrgApiKeyUseCase(repo)
  const result = await useCase.execute(c.get('orgId'))
  return c.json(result)
})

// ── STAGE HISTORY ──────────────────────────────────────────────
app.get('/stage-history', async (c) => {
  const { entity_type, entity_id } = c.req.query()
  if (!entity_id) return c.json({ error: 'entity_id is required' }, 400)
  const repo = new D1StageHistoryRepository(c.env.DB)
  const history = await repo.findByEntity(entity_type as any, entity_id as any, c.get('orgId'))
  return c.json(history.map((h: any) => h.toObject?.() ?? h))
})

// ── LANDINGS helpers ───────────────────────────────────────────
const landingDeps = (env: { DB: D1Database }) => ({
  landings: new D1LandingRepository(env.DB),
  templates: new D1LandingTemplateRepository(env.DB),
  versions: new D1LandingVersionRepository(env.DB),
  events: new D1LandingEventRepository(env.DB),
  idGen: new CryptoIdGenerator(),
})

const actor = (c: any) => ({ role: c.get('userRole') as 'admin' | 'agent', userId: c.get('userId') as string })
const orgId = (c: any) => c.get('orgId') as string

// === Landings ===
app.get('/landings', async (c) => {
  const { landings } = landingDeps(c.env)
  const uc = new ListLandingsUseCase(landings)
  const scope = (c.req.query('scope') as any) || 'mine'
  const kind = c.req.query('kind') as any
  const status = c.req.query('status') as any
  const result = await uc.execute({ actor: actor(c), orgId: orgId(c), scope, filters: { kind, status } })
  return c.json({ landings: result.map(l => l.toObject()) })
})

app.get('/landings/:id', async (c) => {
  const { landings } = landingDeps(c.env)
  const uc = new GetLandingUseCase(landings)
  const l = await uc.execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ landing: l.toObject() })
})

app.post('/landings', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, templates, versions, idGen } = landingDeps(c.env)
  const uc = new CreateLandingFromTemplateUseCase(templates, landings, versions, idGen)
  const r = await uc.execute({
    actor: actor(c), orgId: orgId(c),
    templateId: body.templateId,
    slugBase: body.slugBase,
    brandVoice: body.brandVoice ?? null,
    leadRules: body.leadRules ?? null,
    seoTitle: body.seoTitle ?? null,
    seoDescription: body.seoDescription ?? null,
    ogImageUrl: body.ogImageUrl ?? null,
  })
  return c.json(r, 201)
})

app.patch('/landings/:id', async (c) => {
  const body = (await c.req.json()) as any
  const { landings } = landingDeps(c.env)
  await new UpdateLandingMetadataUseCase(landings).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), patch: body.patch,
  })
  return c.json({ ok: true })
})

app.patch('/landings/:id/blocks', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new UpdateLandingBlocksUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    blocks: body.blocks, label: body.label ?? 'manual-save',
  })
  return c.json(r)
})

app.post('/landings/:id/blocks', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new AddBlockUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    block: body.block, insertAtIndex: body.insertAtIndex,
  })
  return c.json(r, 201)
})

app.delete('/landings/:id/blocks/:blockId', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  await new RemoveBlockUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), blockId: c.req.param('blockId'),
  })
  return c.json({ ok: true })
})

app.post('/landings/:id/blocks/reorder', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  await new ReorderBlocksUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    orderedBlockIds: body.orderedBlockIds,
  })
  return c.json({ ok: true })
})

app.patch('/landings/:id/blocks/:blockId/visibility', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  await new ToggleBlockVisibilityUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    blockId: c.req.param('blockId'), visible: body.visible,
  })
  return c.json({ ok: true })
})

app.get('/landings/:id/versions', async (c) => {
  const { versions } = landingDeps(c.env)
  const list = await versions.listByLanding(c.req.param('id'), 50)
  return c.json({ versions: list.map(v => v.toObject()) })
})

app.post('/landings/:id/rollback/:versionId', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new RollbackLandingUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), versionId: c.req.param('versionId'),
  })
  return c.json(r)
})

app.post('/landings/:id/request-publish', async (c) => {
  const { landings } = landingDeps(c.env)
  await new RequestPublishUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.post('/landings/:id/publish', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new PublishLandingUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
  })
  return c.json(r)
})

app.post('/landings/:id/reject-publish', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any
  const { landings } = landingDeps(c.env)
  await new RejectPublishRequestUseCase(landings).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), note: body.note,
  })
  return c.json({ ok: true })
})

app.post('/landings/:id/archive', async (c) => {
  const { landings } = landingDeps(c.env)
  await new ArchiveLandingUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.post('/landings/:id/unarchive', async (c) => {
  const { landings } = landingDeps(c.env)
  await new UnarchiveLandingUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.get('/landings/:id/analytics', async (c) => {
  const { landings, events } = landingDeps(c.env)
  const rangeDays = (parseInt(c.req.query('rangeDays') || '7', 10) as 7 | 14 | 30)
  const r = await new GetLandingAnalyticsUseCase(landings, events).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), rangeDays,
  })
  return c.json({ summary: r })
})

// === Templates ===
app.get('/landing-templates', async (c) => {
  const { templates } = landingDeps(c.env)
  const kind = c.req.query('kind') as any
  const list = await new ListTemplatesUseCase(templates).execute({ orgId: orgId(c), kind })
  return c.json({ templates: list.map(t => t.toObject()) })
})

app.post('/landing-templates', async (c) => {
  const body = (await c.req.json()) as any
  const { templates, idGen } = landingDeps(c.env)
  const r = await new CreateTemplateUseCase(templates, idGen).execute({
    actor: actor(c), orgId: body.global === true ? null : orgId(c),
    name: body.name, kind: body.kind, description: body.description,
    previewImageUrl: body.previewImageUrl, blocks: body.blocks, sortOrder: body.sortOrder,
  })
  return c.json(r, 201)
})

app.patch('/landing-templates/:id', async (c) => {
  const body = (await c.req.json()) as any
  const { templates } = landingDeps(c.env)
  await new UpdateTemplateUseCase(templates).execute({
    actor: actor(c), orgId: orgId(c), templateId: c.req.param('id'), patch: body.patch,
  })
  return c.json({ ok: true })
})

export default app
