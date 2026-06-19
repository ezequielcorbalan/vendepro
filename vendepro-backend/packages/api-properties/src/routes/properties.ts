import type { Hono } from 'hono'
import {
  D1PropertyRepository,
  D1LeadRepository,
  D1StageHistoryRepository,
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
import type { PropertyStageValue } from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string; BROWSER: Fetcher; API_PUBLIC_URL: string }
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

  // Propiedad vinculada a un lead (para avisar antes del sync lead->property).
  app.get('/properties/by-lead/:leadId', async (c) => {
    const repo = new D1PropertyRepository(c.env.DB)
    const prop = await repo.findByLeadId(c.req.param('leadId'), c.get('orgId'))
    return c.json(prop)
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
      return c.json({ error: e.message || 'Error al actualizar propiedad' }, 400)
    }
    return c.json({ success: true })
  })

  app.put('/properties/:id/stage', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1PropertyRepository(c.env.DB)
    const historyRepo = new D1StageHistoryRepository(c.env.DB)
    const leadRepo = new D1LeadRepository(c.env.DB)
    const propertyId = c.req.param('id')
    const orgId = c.get('orgId')
    const changedBy = c.get('userId')
    try {
      // Resolve to a slug regardless of whether the caller sent commercial_stage
      // or commercial_stage_id; both paths go through UpdatePropertyStageUseCase
      // so state-machine validation, sync engine, and stage_history all fire.
      let stageSlug: string | null = body.commercial_stage ?? null
      if (!stageSlug && body.commercial_stage_id) {
        stageSlug = await repo.findStageSlugById(Number(body.commercial_stage_id))
        if (!stageSlug) return c.json({ error: `commercial_stage_id ${body.commercial_stage_id} no existe` }, 400)
      }
      if (!stageSlug) return c.json({ error: 'commercial_stage o commercial_stage_id requerido' }, 400)

      const useCase = new UpdatePropertyStageUseCase(repo, historyRepo, leadRepo)
      await useCase.execute({
        propertyId,
        orgId,
        newStage: stageSlug as PropertyStageValue,
        changedBy,
        notes: body.notes ?? null,
      })
    } catch (e: any) {
      return c.json({ error: e.message || 'Error al cambiar etapa' }, 400)
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

  // ── PRICE HISTORY ────────────────────────────────────────────
  app.get('/properties/:id/price-history', async (c) => {
    const repo = new D1PropertyRepository(c.env.DB)
    const items = await repo.findPriceHistory(c.req.param('id'), c.get('orgId'))
    return c.json(items)
  })

  app.post('/properties/:id/price-change', async (c) => {
    const propertyId = c.req.param('id')
    const orgId = c.get('orgId')
    const body = (await c.req.json()) as any
    const newPrice = Number(body.price)
    if (!Number.isFinite(newPrice) || newPrice <= 0) {
      return c.json({ error: 'Precio inválido' }, 400)
    }
    const repo = new D1PropertyRepository(c.env.DB)
    const existing = await repo.findById(propertyId, orgId)
    if (!existing) return c.json({ error: 'Not found' }, 404)
    const previous = existing.asking_price ?? null
    const idGen = new CryptoIdGenerator()
    await repo.addPriceHistory({
      id: idGen.generate(),
      property_id: propertyId,
      org_id: orgId,
      price_usd: newPrice,
      previous_price_usd: previous,
      reason: typeof body.reason === 'string' ? body.reason : null,
      changed_by: c.get('userId'),
      changed_at: new Date().toISOString(),
    })
    const useCase = new UpdatePropertyPriceUseCase(repo)
    await useCase.execute({
      propertyId,
      orgId,
      newPrice,
      currency: (body.currency as 'USD' | 'ARS') || 'USD',
    })
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
