import type { Hono } from 'hono'
import {
  D1LandingRepository,
  D1AppraisalRepository,
  CryptoIdGenerator,
} from '@vendepro/infrastructure'
import {
  ListTasacionTemplatesUseCase,
  CloneLandingAsTasacionUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string; BROWSER: Fetcher; API_PUBLIC_URL: string }
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

  // POST /landings/:id/clone-as-tasacion
  app.post('/landings/:id/clone-as-tasacion', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const landings = new D1LandingRepository(c.env.DB)
    const appraisals = new D1AppraisalRepository(c.env.DB)
    const idGen = new CryptoIdGenerator()
    const uc = new CloneLandingAsTasacionUseCase(landings, appraisals, idGen)
    const r = await uc.execute({
      actor: { role: c.get('userRole') as 'admin' | 'agent', userId: c.get('userId') },
      orgId: c.get('orgId'),
      landingId: c.req.param('id'),
      property_id: body.property_id ?? null,
      lead_id: body.lead_id ?? null,
      contact_id: body.contact_id ?? null,
      address: body.address ?? null,
    })
    return c.json(r, 201)
  })
}
