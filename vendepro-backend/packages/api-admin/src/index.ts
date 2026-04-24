import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1UserRepository, D1ObjectiveRepository, D1TemplateBlockRepository, JwtAuthService, CryptoIdGenerator, D1RoleRepository, D1NotificationRepository, D1OrganizationRepository, D1AppraisalTemplateRepository, D1OrgVariableRepository } from '@vendepro/infrastructure'
import { CreateAgentUseCase, GetAgentsUseCase, SetObjectivesUseCase, UpdateAgentRoleUseCase, GetRolesUseCase, GetOrgSettingsUseCase, UpdateOrgSettingsUseCase, GetUserProfileUseCase, UpdateUserProfileUseCase, GetUserNotificationsUseCase, ListAppraisalTemplatesUseCase, GetAppraisalTemplateUseCase, CreateAppraisalTemplateUseCase, UpdateAppraisalTemplateUseCase, DuplicateAppraisalTemplateUseCase, ArchiveAppraisalTemplateUseCase, ListOrgVariablesUseCase, CreateOrgVariableUseCase, UpdateOrgVariableUseCase, DeleteOrgVariableUseCase } from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.use('*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

// ── AGENTS ─────────────────────────────────────────────────────
app.get('/agents', async (c) => {
  const repo = new D1UserRepository(c.env.DB)
  const useCase = new GetAgentsUseCase(repo)
  const agents = await useCase.execute(c.get('orgId'), c.get('userRole'))
  return c.json(agents.map(a => {
    const { password_hash, ...rest } = a.toObject()
    return rest
  }))
})

app.post('/create-agent', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1UserRepository(c.env.DB)
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const useCase = new CreateAgentUseCase(repo, authService, new CryptoIdGenerator())
  const result = await useCase.execute({
    requestingUserRole: c.get('userRole'),
    org_id: c.get('orgId'),
    email: body.email,
    password: body.password,
    name: body.name || body.full_name,
    role: body.role || 'agent',
    phone: body.phone ?? null,
  })
  return c.json(result, 201)
})

app.delete('/agents', async (c) => {
  const { id } = c.req.query()
  const repo = new D1UserRepository(c.env.DB)
  await repo.delete(id, c.get('orgId'))
  return c.json({ success: true })
})

app.get('/roles', async (c) => {
  const repo = new D1RoleRepository(c.env.DB)
  const useCase = new GetRolesUseCase(repo)
  const roles = await useCase.execute(c.get('userRole'))
  return c.json(roles.map(r => r.toObject()))
})

app.patch('/agents/role', async (c) => {
  const body = (await c.req.json()) as any
  if (!body.id || !body.role_id) return c.json({ error: 'id y role_id son requeridos' }, 400)
  const userRepo = new D1UserRepository(c.env.DB)
  const roleRepo = new D1RoleRepository(c.env.DB)
  const useCase = new UpdateAgentRoleUseCase(userRepo, roleRepo)
  await useCase.execute({
    requestingUserRole: c.get('userRole'),
    agentId: body.id,
    orgId: c.get('orgId'),
    roleId: body.role_id,
  })
  return c.json({ success: true })
})

// ── OBJECTIVES ─────────────────────────────────────────────────
app.get('/objectives', async (c) => {
  const { agent_id, period_type } = c.req.query()
  const repo = new D1ObjectiveRepository(c.env.DB)
  const objs = await repo.findByOrg(c.get('orgId'), { agent_id, period_type })
  return c.json(objs.map(o => o.toObject()))
})

app.post('/objectives', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ObjectiveRepository(c.env.DB)
  const useCase = new SetObjectivesUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ requestingUserRole: c.get('userRole'), org_id: c.get('orgId'), ...body })
  return c.json(result, 201)
})

app.delete('/objectives', async (c) => {
  const { id } = c.req.query()
  const repo = new D1ObjectiveRepository(c.env.DB)
  await repo.delete(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── TEMPLATE BLOCKS ────────────────────────────────────────────
app.get('/tasacion-blocks', async (c) => {
  const repo = new D1TemplateBlockRepository(c.env.DB)
  const blocks = await repo.findByOrg(c.get('orgId'))
  return c.json(blocks.map(b => b.toObject()))
})

app.post('/tasacion-blocks', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1TemplateBlockRepository(c.env.DB)
  const { TemplateBlock } = await import('@vendepro/core')
  const block = TemplateBlock.create({ id: new CryptoIdGenerator().generate(), org_id: c.get('orgId'), ...body })
  await repo.save(block)
  return c.json(block.toObject(), 201)
})

app.put('/tasacion-blocks/:id', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1TemplateBlockRepository(c.env.DB)
  const block = await repo.findById(c.req.param('id'), c.get('orgId'))
  if (!block) return c.json({ error: 'Not found' }, 404)
  block.update(body)
  await repo.save(block)
  return c.json({ success: true })
})

app.delete('/tasacion-blocks/:id', async (c) => {
  const repo = new D1TemplateBlockRepository(c.env.DB)
  await repo.delete(c.req.param('id'), c.get('orgId'))
  return c.json({ success: true })
})

app.post('/tasacion-blocks/reorder', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1TemplateBlockRepository(c.env.DB)
  await repo.updateOrder(body.blocks, c.get('orgId'))
  return c.json({ success: true })
})

// ── ORG SETTINGS & PROFILE ─────────────────────────────────────
app.get('/org-settings', async (c) => {
  const repo = new D1OrganizationRepository(c.env.DB)
  const useCase = new GetOrgSettingsUseCase(repo)
  const org = await useCase.execute(c.get('orgId'))
  return c.json(org ? org.toObject() : {})
})

app.put('/org-settings', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1OrganizationRepository(c.env.DB)
  const useCase = new UpdateOrgSettingsUseCase(repo)
  await useCase.execute({
    orgId: c.get('orgId'),
    patch: {
      name: body.name,
      slug: body.slug,
      logo_url: body.logo_url,
      brand_color: body.brand_color,
      canva_template_id: body.canva_template_id,
      canva_report_template_id: body.canva_report_template_id,
    },
  })
  return c.json({ success: true })
})

app.get('/profile', async (c) => {
  const repo = new D1UserRepository(c.env.DB)
  const useCase = new GetUserProfileUseCase(repo)
  const user = await useCase.execute(c.get('userId'))
  if (!user) return c.json({})
  const { password_hash, ...rest } = user.toObject()
  return c.json(rest)
})

app.put('/profile', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1UserRepository(c.env.DB)
  const useCase = new UpdateUserProfileUseCase(repo)
  await useCase.execute({
    userId: c.get('userId'),
    full_name: body.full_name,
    phone: body.phone ?? null,
    photo_url: body.photo_url ?? null,
  })
  return c.json({ success: true })
})

app.get('/notifications', async (c) => {
  const repo = new D1NotificationRepository(c.env.DB)
  const useCase = new GetUserNotificationsUseCase(repo)
  try {
    const notifications = await useCase.execute(c.get('userId'), c.get('orgId'), 20)
    return c.json(notifications.map(n => n.toObject()))
  } catch {
    return c.json([])
  }
})

// ── APPRAISAL TEMPLATES ────────────────────────────────────────
app.get('/appraisal-templates', async (c) => {
  const uc = new ListAppraisalTemplatesUseCase(new D1AppraisalTemplateRepository(c.env.DB))
  const kind = c.req.query('kind') as any
  const onlyActive = c.req.query('active') === '1'
  const list = await uc.execute({ orgId: c.get('orgId'), kind, onlyActive })
  return c.json(list)
})

app.get('/appraisal-templates/:id', async (c) => {
  const uc = new GetAppraisalTemplateUseCase(new D1AppraisalTemplateRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  if (!r) return c.json({ error: 'not found' }, 404)
  return c.json(r)
})

app.post('/appraisal-templates', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new CreateAppraisalTemplateUseCase(
    new D1AppraisalTemplateRepository(c.env.DB),
    new CryptoIdGenerator(),
  )
  const r = await uc.execute({
    orgId: c.get('orgId'),
    name: body.name,
    kind: body.kind,
    description: body.description ?? null,
    preview_image_url: body.preview_image_url ?? null,
    blocks: body.blocks ?? [],
  })
  return c.json(r, 201)
})

app.put('/appraisal-templates/:id', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new UpdateAppraisalTemplateUseCase(new D1AppraisalTemplateRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId'), ...body })
  return c.json(r)
})

app.post('/appraisal-templates/:id/duplicate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any
  const uc = new DuplicateAppraisalTemplateUseCase(
    new D1AppraisalTemplateRepository(c.env.DB),
    new CryptoIdGenerator(),
  )
  const r = await uc.execute({
    sourceId: c.req.param('id'),
    orgId: c.get('orgId'),
    newName: body.new_name,
  })
  return c.json(r, 201)
})

app.delete('/appraisal-templates/:id', async (c) => {
  const uc = new ArchiveAppraisalTemplateUseCase(new D1AppraisalTemplateRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  return c.json(r)
})

// ── ORG VARIABLES ──────────────────────────────────────────────
app.get('/org-variables', async (c) => {
  const uc = new ListOrgVariablesUseCase(new D1OrgVariableRepository(c.env.DB))
  const namespace = c.req.query('namespace') as any
  const list = await uc.execute({ orgId: c.get('orgId'), namespace })
  return c.json(list)
})

app.post('/org-variables', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new CreateOrgVariableUseCase(
    new D1OrgVariableRepository(c.env.DB),
    new CryptoIdGenerator(),
  )
  const r = await uc.execute({
    orgId: c.get('orgId'),
    key: body.key,
    value: body.value,
    value_type: body.value_type,
    label: body.label ?? null,
    namespace: body.namespace ?? 'custom',
  })
  return c.json(r, 201)
})

app.put('/org-variables/:id', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new UpdateOrgVariableUseCase(new D1OrgVariableRepository(c.env.DB))
  const r = await uc.execute({
    id: c.req.param('id'),
    orgId: c.get('orgId'),
    value: body.value,
    label: body.label,
  })
  return c.json(r)
})

app.delete('/org-variables/:id', async (c) => {
  const uc = new DeleteOrgVariableUseCase(new D1OrgVariableRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  return c.json(r)
})

export default app
