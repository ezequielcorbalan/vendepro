import type { Hono } from 'hono'
import {
  D1PropertyRepository,
  CryptoIdGenerator,
  R2StorageService,
} from '@vendepro/infrastructure'
import {
  GetPropertiesUseCase,
  CreatePropertyUseCase,
  UpdatePropertyPriceUseCase,
  UpdatePropertyStatusUseCase,
  GetPropertyCatalogsUseCase,
  GetPropertyDetailUseCase,
  UpdatePropertyUseCase,
  UpdatePropertyStageUseCase,
  MarkExternalReportUseCase,
  ClearExternalReportUseCase,
  DeletePropertyUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

export function registerPropertyRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  // ── CATALOG ──────────────────────────────────────────────────
  app.get('/property-config', async (c) => {
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new GetPropertyCatalogsUseCase(repo)
    const result = await useCase.execute()
    return c.json(result)
  })

  // ── PROPERTIES ────────────────────────────────────────────────
  app.get('/properties', async (c) => {
    const { status, agent_id, neighborhood, property_type, q, commercial_stage, operation_type } = c.req.query()
    const qs = c.req.query()
    const operation_type_id = qs.operation_type_id ? Number(qs.operation_type_id) : undefined
    const commercial_stage_id = qs.commercial_stage_id ? Number(qs.commercial_stage_id) : undefined
    const status_id = qs.status_id ? Number(qs.status_id) : undefined
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new GetPropertiesUseCase(repo)
    const items = await useCase.execute(c.get('orgId'), {
      status, agent_id, neighborhood, property_type, search: q,
      commercial_stage, operation_type,
      operation_type_id, commercial_stage_id, status_id,
    })
    return c.json(items.map(p => p.toObject()))
  })

  app.post('/properties', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new CreatePropertyUseCase(repo, new CryptoIdGenerator())
    const result = await useCase.execute({ ...body, org_id: c.get('orgId'), agent_id: body.agent_id || c.get('userId') })
    return c.json(result, 201)
  })

  app.get('/properties/:id', async (c) => {
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new GetPropertyDetailUseCase(repo)
    const result = await useCase.execute(c.req.param('id'), c.get('orgId'))
    if (!result) return c.json({ error: 'Not found' }, 404)
    return c.json({ ...result.property.toObject(), photos: result.photos })
  })

  app.put('/properties/:id', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new UpdatePropertyUseCase(repo)
    try {
      await useCase.execute(c.req.param('id'), c.get('orgId'), body)
    } catch (e: any) {
      if (e.statusCode === 404) return c.json({ error: 'Not found' }, 404)
      throw e
    }
    return c.json({ success: true })
  })

  app.put('/properties/:id/stage', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1PropertyRepository(c.env.DB)
    // The stage handler accepts commercial_stage_id (ID) or commercial_stage (slug legacy)
    // UpdatePropertyStageUseCase expects a slug — resolve stageSlug here
    if (body.commercial_stage_id) {
      // updateStage internally resolves ID from slug via DB; but it takes a slug as input.
      // We need to bypass and directly update using update() for ID-based approach.
      const updateUC = new UpdatePropertyUseCase(repo)
      try {
        await updateUC.execute(c.req.param('id'), c.get('orgId'), {
          commercial_stage_id: body.commercial_stage_id,
        })
      } catch (e: any) {
        if (e.statusCode === 404) return c.json({ error: 'Not found' }, 404)
        throw e
      }
    } else if (body.commercial_stage) {
      const useCase = new UpdatePropertyStageUseCase(repo)
      await useCase.execute(c.req.param('id'), c.get('orgId'), body.commercial_stage)
    }
    return c.json({ success: true })
  })

  app.put('/properties/:id/price', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new UpdatePropertyPriceUseCase(repo)
    await useCase.execute({ propertyId: c.req.param('id'), orgId: c.get('orgId'), newPrice: body.price, currency: body.currency || 'USD' })
    return c.json({ success: true })
  })

  app.put('/properties/:id/status', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new UpdatePropertyStatusUseCase(repo)
    await useCase.execute({ propertyId: c.req.param('id'), orgId: c.get('orgId'), newStatus: body.status })
    return c.json({ success: true })
  })

  app.delete('/properties/:id', async (c) => {
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new DeletePropertyUseCase(repo)
    await useCase.execute(c.req.param('id'), c.get('orgId'))
    return c.json({ success: true })
  })

  // ── EXTERNAL REPORT TRACKING ─────────────────────────────────
  app.post('/properties/:id/external-report', async (c) => {
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new MarkExternalReportUseCase(repo)
    await useCase.execute(c.req.param('id'), c.get('orgId'))
    return c.json({ success: true })
  })

  app.delete('/properties/:id/external-report', async (c) => {
    const repo = new D1PropertyRepository(c.env.DB)
    const useCase = new ClearExternalReportUseCase(repo)
    await useCase.execute(c.req.param('id'), c.get('orgId'))
    return c.json({ success: true })
  })
}
