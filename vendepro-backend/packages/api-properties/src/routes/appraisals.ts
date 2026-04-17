import type { Hono } from 'hono'
import { D1AppraisalRepository, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  GetAppraisalsUseCase,
  GetAppraisalDetailUseCase,
  CreateAppraisalUseCase,
  UpdateAppraisalUseCase,
  DeleteAppraisalUseCase,
  AddAppraisalComparableUseCase,
  RemoveAppraisalComparableUseCase,
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
    const useCase = new CreateAppraisalUseCase(repo, new CryptoIdGenerator())
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
    return c.json({ success: true })
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
}
