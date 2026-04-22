import type { Hono } from 'hono'
import { D1LandingRepository } from '@vendepro/infrastructure'
import { ListTasacionTemplatesUseCase } from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

/**
 * Endpoints para usar landings como plantillas de tasación. Conviven con las
 * rutas /landings/* del worker api-crm — acá sólo viven los handlers que
 * cruzan con la tabla appraisals (que ya pertenece a este worker).
 */
export function registerLandingTemplateRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  // GET /landings/templates?type=tasacion
  app.get('/landings/templates', async (c) => {
    const type = c.req.query('type') ?? 'tasacion'
    const repo = new D1LandingRepository(c.env.DB)
    const uc = new ListTasacionTemplatesUseCase(repo)
    if (type !== 'tasacion') {
      // Por ahora sólo soportamos plantillas de tasación. Devolvemos lista
      // vacía para no romper el frontend si pide otro tipo.
      return c.json({ templates: [] })
    }
    const list = await uc.execute({ orgId: c.get('orgId') })
    return c.json({ templates: list.map((l) => l.toObject()) })
  })
}
