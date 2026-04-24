import type { Hono } from 'hono'
import { D1AppraisalRepository, D1AppraisalTemplateRepository, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  GetAppraisalsUseCase,
  GetAppraisalDetailUseCase,
  CreateAppraisalUseCase,
  UpdateAppraisalUseCase,
  DeleteAppraisalUseCase,
  AddAppraisalComparableUseCase,
  RemoveAppraisalComparableUseCase,
  SyncTemplateSnapshotUseCase,
  SetBlockOverridesUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

export function registerAppraisalRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  app.get('/appraisals', async (c) => {
    const { id, lead_id, status } = c.req.query()
    const repo = new D1AppraisalRepository(c.env.DB)
    const orgId = c.get('orgId')

    if (id) {
      const useCase = new GetAppraisalDetailUseCase(repo)
      const result = await useCase.execute(id, orgId)
      if (!result) return c.json({ error: 'Not found' }, 404)
      const r = result.appraisal.toObject() as any
      return c.json({
        ...r,
        comparables: result.comparables,
        linked_property: r.property_id
          ? { id: r.property_id, address: r.linked_property_address ?? null, neighborhood: r.linked_property_neighborhood ?? null }
          : null,
      })
    }

    const useCase = new GetAppraisalsUseCase(repo)
    const items = await useCase.execute(orgId, { stage: status, agent_id: lead_id ? undefined : undefined })
    // Apply filters manually since the use-case uses 'stage' for status
    let rows = items.map(a => a.toObject())
    if (status) rows = rows.filter(r => r.status === status)
    if (lead_id) rows = rows.filter(r => r.lead_id === lead_id)
    return c.json(rows)
  })

  app.post('/appraisals', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1AppraisalRepository(c.env.DB)
    const orgId = c.get('orgId')
    const agentId = body.agent_id || c.get('userId')
    const useCase = new CreateAppraisalUseCase(
      repo,
      new CryptoIdGenerator(),
      new D1AppraisalTemplateRepository(c.env.DB),
    )
    const result = await useCase.execute({ ...body, org_id: orgId, agent_id: agentId })
    return c.json(result, 201)
  })

  app.put('/appraisals', async (c) => {
    const body = (await c.req.json()) as any
    const { id } = c.req.query()
    const repo = new D1AppraisalRepository(c.env.DB)
    const orgId = c.get('orgId')
    const useCase = new UpdateAppraisalUseCase(repo)
    try {
      await useCase.execute(id ?? '', orgId, body)
    } catch (e: any) {
      if (e.statusCode === 404) return c.json({ error: 'Not found' }, 404)
      throw e
    }
    const refreshed = await repo.findById(id ?? '', orgId)
    return c.json({ success: true, public_slug: refreshed?.public_slug ?? null })
  })

  // Publish / ensure public_slug. Auto-generates a slug from the address if empty.
  app.post('/appraisals/publish', async (c) => {
    const { id } = c.req.query()
    const repo = new D1AppraisalRepository(c.env.DB)
    const orgId = c.get('orgId')
    const existing = await repo.findById(id ?? '', orgId)
    if (!existing) return c.json({ error: 'Not found' }, 404)
    if (existing.public_slug) {
      return c.json({ success: true, public_slug: existing.public_slug })
    }
    const slugify = (raw: string) => raw
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'tasacion'
    let base = slugify(existing.property_address || 'tasacion')
    let slug = base
    // Ensure uniqueness: try a few suffixes; DB has a unique index so we still
    // check by findBySlug.
    let attempt = 0
    while (attempt < 5) {
      const hit = await repo.findBySlug(slug)
      if (!hit || hit.id === existing.id) break
      attempt += 1
      slug = `${base}-${attempt + 1}`
    }
    if (attempt >= 5) {
      slug = `${base}-${existing.id.slice(0, 6)}`
    }
    await repo.update(existing.id, orgId, { public_slug: slug })
    return c.json({ success: true, public_slug: slug })
  })

  app.delete('/appraisals', async (c) => {
    const { id } = c.req.query()
    const repo = new D1AppraisalRepository(c.env.DB)
    const useCase = new DeleteAppraisalUseCase(repo)
    await useCase.execute(id ?? '', c.get('orgId'))
    return c.json({ success: true })
  })

  // Comparables
  app.post('/appraisals/comparables', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1AppraisalRepository(c.env.DB)
    const useCase = new AddAppraisalComparableUseCase(repo, new CryptoIdGenerator())
    const result = await useCase.execute(body)
    return c.json(result, 201)
  })

  app.delete('/appraisals/comparables', async (c) => {
    const { id } = c.req.query()
    const repo = new D1AppraisalRepository(c.env.DB)
    const useCase = new RemoveAppraisalComparableUseCase(repo)
    await useCase.execute(id ?? '')
    return c.json({ success: true })
  })

  app.post('/appraisals/:id/sync-template', async (c) => {
    const uc = new SyncTemplateSnapshotUseCase(
      new D1AppraisalRepository(c.env.DB),
      new D1AppraisalTemplateRepository(c.env.DB),
    )
    const r = await uc.execute({ appraisalId: c.req.param('id'), orgId: c.get('orgId') })
    return c.json(r)
  })

  app.patch('/appraisals/:id/blocks/:block_id', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const uc = new SetBlockOverridesUseCase(new D1AppraisalRepository(c.env.DB))
    await uc.execute({
      appraisalId: c.req.param('id'),
      orgId: c.get('orgId'),
      blockId: c.req.param('block_id'),
      patch: body ?? {},
    })
    return c.json({ ok: true })
  })
}
