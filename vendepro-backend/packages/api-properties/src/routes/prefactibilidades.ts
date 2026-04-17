import type { Hono } from 'hono'
import { D1PrefactibilidadRepository, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  GetPrefactibilidadesUseCase,
  GetPrefactibilidadDetailUseCase,
  CreatePrefactibilidadUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

export function registerPrefactibilidadRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  app.get('/prefactibilidades', async (c) => {
    const repo = new D1PrefactibilidadRepository(c.env.DB)
    const orgId = c.get('orgId')
    try {
      const useCase = new GetPrefactibilidadesUseCase(repo)
      const items = await useCase.execute(orgId)
      return c.json(items.map(p => p.toObject()))
    } catch { return c.json([]) }
  })

  app.post('/prefactibilidades', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1PrefactibilidadRepository(c.env.DB)
    const orgId = c.get('orgId')
    const agentId = c.get('userId')
    try {
      const useCase = new CreatePrefactibilidadUseCase(repo, new CryptoIdGenerator())
      const result = await useCase.execute({
        ...body,
        org_id: orgId,
        agent_id: agentId,
        units_mix: body.units_mix ? JSON.stringify(body.units_mix) : null,
        amenities: body.amenities ? JSON.stringify(body.amenities) : null,
        comparables: body.comparables ? JSON.stringify(body.comparables) : null,
        timeline: body.timeline ? JSON.stringify(body.timeline) : null,
      })
      return c.json(result, 201)
    } catch (e: any) {
      return c.json({ error: e.message || 'Error creating prefactibilidad' }, 500)
    }
  })

  app.get('/prefactibilidades/:id', async (c) => {
    const repo = new D1PrefactibilidadRepository(c.env.DB)
    const orgId = c.get('orgId')
    try {
      const useCase = new GetPrefactibilidadDetailUseCase(repo)
      const result = await useCase.execute(c.req.param('id'), orgId)
      if (!result) return c.json({ error: 'Not found' }, 404)
      return c.json(result.toObject())
    } catch { return c.json({ error: 'Not found' }, 404) }
  })
}
