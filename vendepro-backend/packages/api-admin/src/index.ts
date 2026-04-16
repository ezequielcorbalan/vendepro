import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1UserRepository, D1ObjectiveRepository, D1TemplateBlockRepository, JwtAuthService, CryptoIdGenerator } from '@vendepro/infrastructure'
import { CreateAgentUseCase, GetAgentsUseCase, SetObjectivesUseCase, UpdateAgentRoleUseCase } from '@vendepro/core'

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
  const userRole = c.get('userRole')
  if (userRole !== 'admin' && userRole !== 'owner') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const roles = await c.env.DB
    .prepare('SELECT id, name, label FROM roles ORDER BY id')
    .all()
  return c.json(roles.results)
})

app.patch('/agents/role', async (c) => {
  const body = (await c.req.json()) as any
  const { id, role_id } = body

  if (!id || !role_id) return c.json({ error: 'id y role_id son requeridos' }, 400)

  const role = await c.env.DB
    .prepare('SELECT id, name, label FROM roles WHERE id = ?')
    .bind(role_id)
    .first() as any

  if (!role) return c.json({ error: 'Rol no encontrado' }, 404)

  const repo = new D1UserRepository(c.env.DB)
  const useCase = new UpdateAgentRoleUseCase(repo)

  await useCase.execute({
    requestingUserRole: c.get('userRole'),
    agentId: id,
    orgId: c.get('orgId'),
    roleId: role.id,
    roleName: role.name,
  })

  return c.json({ success: true, role: { id: role.id, name: role.name, label: role.label } })
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
  const row = await c.env.DB.prepare('SELECT * FROM organizations WHERE id = ?').bind(c.get('orgId')).first()
  return c.json(row ?? {})
})

app.put('/org-settings', async (c) => {
  const body = (await c.req.json()) as any
  const { name, logo_url, brand_color, canva_template_id, canva_report_template_id, slug } = body

  if (slug) {
    // Verify slug is not already taken by another org
    const existing = await c.env.DB.prepare(
      'SELECT id FROM organizations WHERE slug = ? AND id != ?'
    ).bind(slug, c.get('orgId')).first()
    if (existing) return c.json({ error: 'El identificador ya está en uso', code: 'CONFLICT_ERROR' }, 409)

    await c.env.DB.prepare(`
      UPDATE organizations SET name=?, logo_url=?, brand_color=?, canva_template_id=?, canva_report_template_id=?, slug=? WHERE id=?
    `).bind(name, logo_url, brand_color, canva_template_id, canva_report_template_id, slug, c.get('orgId')).run()
  } else {
    await c.env.DB.prepare(`
      UPDATE organizations SET name=?, logo_url=?, brand_color=?, canva_template_id=?, canva_report_template_id=? WHERE id=?
    `).bind(name, logo_url, brand_color, canva_template_id, canva_report_template_id, c.get('orgId')).run()
  }

  return c.json({ success: true })
})

app.get('/profile', async (c) => {
  const row = await c.env.DB.prepare('SELECT id, email, full_name, phone, photo_url, role, org_id FROM users WHERE id = ?').bind(c.get('userId')).first()
  return c.json(row ?? {})
})

app.put('/profile', async (c) => {
  const body = (await c.req.json()) as any
  const { full_name, phone, photo_url } = body
  await c.env.DB.prepare(
    'UPDATE users SET full_name=?, phone=?, photo_url=? WHERE id=?'
  ).bind(full_name ?? null, phone ?? null, photo_url ?? null, c.get('userId')).run()
  return c.json({ success: true })
})

app.get('/notifications', async (c) => {
  try {
    const rows = (await c.env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').bind(c.get('userId')).all()).results
    return c.json(rows)
  } catch {
    return c.json([])
  }
})

export default app
