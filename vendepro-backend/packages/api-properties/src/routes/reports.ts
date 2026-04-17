import type { Hono } from 'hono'
import { D1ReportRepository, R2StorageService, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  GetReportsUseCase,
  GetReportDetailUseCase,
  CreateReportUseCase,
  UpdateReportUseCase,
  DeleteReportUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

export function registerReportRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  app.get('/reports', async (c) => {
    const { property_id } = c.req.query()
    const repo = new D1ReportRepository(c.env.DB)
    const useCase = new GetReportsUseCase(repo)
    const items = await useCase.execute(c.get('orgId'), property_id || undefined)
    return c.json(items.map(r => r.toObject()))
  })

  app.post('/reports', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1ReportRepository(c.env.DB)
    const useCase = new CreateReportUseCase(repo, new CryptoIdGenerator())
    const result = await useCase.execute({ ...body, createdBy: c.get('userId') })
    return c.json(result)
  })

  app.get('/reports/:id', async (c) => {
    const id = c.req.param('id')
    const repo = new D1ReportRepository(c.env.DB)
    const useCase = new GetReportDetailUseCase(repo)
    const result = await useCase.execute(id, c.get('orgId'))
    if (!result) return c.json({ error: 'Reporte no encontrado' }, 404)
    return c.json(result)
  })

  app.put('/reports/:id', async (c) => {
    const id = c.req.param('id')
    const body = (await c.req.json()) as any
    const repo = new D1ReportRepository(c.env.DB)
    const useCase = new UpdateReportUseCase(repo, new CryptoIdGenerator())
    try {
      const result = await useCase.execute({
        id,
        orgId: c.get('orgId'),
        userId: c.get('userId'),
        userRole: c.get('userRole'),
        ...body,
      })
      return c.json(result)
    } catch (e: any) {
      if (e.statusCode === 404) return c.json({ error: e.message }, 404)
      if (e.statusCode === 403) return c.json({ error: e.message }, 403)
      throw e
    }
  })

  app.delete('/reports/:id', async (c) => {
    const id = c.req.param('id')
    const repo = new D1ReportRepository(c.env.DB)
    const storage = new R2StorageService(c.env.R2, c.env.R2_PUBLIC_URL)
    const useCase = new DeleteReportUseCase(repo, storage)
    try {
      const result = await useCase.execute(id, c.get('orgId'), c.get('userId'), c.get('userRole'))
      return c.json(result)
    } catch (e: any) {
      if (e.statusCode === 404) return c.json({ error: e.message }, 404)
      if (e.statusCode === 403) return c.json({ error: e.message }, 403)
      throw e
    }
  })
}
