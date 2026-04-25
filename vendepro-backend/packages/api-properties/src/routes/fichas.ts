import type { Hono } from 'hono'
import { D1FichaRepository, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  CreateFichaUseCase,
  GetFichaUseCase,
  ListFichasUseCase,
  UpdateFichaUseCase,
  DeleteFichaUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string; BROWSER: Fetcher; API_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

export function registerFichaRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  // List — supports ?lead_id=X, ?agent_id=Y, ?contact_id=Z (contact_id currently ignored at the DB level)
  app.get('/fichas', async (c) => {
    const { lead_id, contact_id, agent_id } = c.req.query()
    const repo = new D1FichaRepository(c.env.DB)
    const orgId = c.get('orgId')
    try {
      const useCase = new ListFichasUseCase(repo)
      const items = await useCase.execute({
        org_id: orgId,
        lead_id: lead_id ?? null,
        contact_id: contact_id ?? null,
        agent_id: agent_id ?? null,
      })
      return c.json(items.map(f => f.toObject()))
    } catch {
      return c.json([])
    }
  })

  // Detail
  app.get('/fichas/:id', async (c) => {
    const repo = new D1FichaRepository(c.env.DB)
    const orgId = c.get('orgId')
    try {
      const useCase = new GetFichaUseCase(repo)
      const result = await useCase.execute(c.req.param('id'), orgId)
      if (!result) return c.json({ error: 'Not found' }, 404)
      return c.json(result.toObject())
    } catch {
      return c.json({ error: 'Not found' }, 404)
    }
  })

  // Create
  app.post('/fichas', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1FichaRepository(c.env.DB)
    const orgId = c.get('orgId')
    const agentId = body.agent_id || c.get('userId')
    try {
      const useCase = new CreateFichaUseCase(repo, new CryptoIdGenerator())
      const result = await useCase.execute({
        ...body,
        org_id: orgId,
        agent_id: agentId,
      })
      return c.json(result, 201)
    } catch (e: any) {
      if (e.statusCode === 400) return c.json({ error: e.message }, 400)
      return c.json({ error: e.message || 'Error creating ficha' }, 500)
    }
  })

  // Update
  app.put('/fichas/:id', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1FichaRepository(c.env.DB)
    const orgId = c.get('orgId')
    const useCase = new UpdateFichaUseCase(repo)
    try {
      await useCase.execute(c.req.param('id'), orgId, body)
    } catch (e: any) {
      if (e.statusCode === 404) return c.json({ error: 'Not found' }, 404)
      throw e
    }
    return c.json({ success: true })
  })

  // Delete
  app.delete('/fichas/:id', async (c) => {
    const repo = new D1FichaRepository(c.env.DB)
    const orgId = c.get('orgId')
    const useCase = new DeleteFichaUseCase(repo)
    try {
      await useCase.execute(c.req.param('id'), orgId)
    } catch (e: any) {
      if (e.statusCode === 404) return c.json({ error: 'Not found' }, 404)
      throw e
    }
    return c.json({ success: true })
  })
}
