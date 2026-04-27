import type { Hono } from 'hono'
import { D1SoldPropertyRepository, CryptoIdGenerator } from '@vendepro/infrastructure'
import {
  ListSoldPropertiesUseCase,
  GetSoldPropertyUseCase,
  CreateSoldPropertyUseCase,
  UpdateSoldPropertyUseCase,
  DeleteSoldPropertyUseCase,
  AddSoldPropertyPhotoUseCase,
  RemoveSoldPropertyPhotoUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

function originFromQuery(q: string | undefined): 'mine' | 'team' | 'external' | 'all' | undefined {
  if (!q) return undefined
  if (q === 'mine' || q === 'team' || q === 'external' || q === 'all') return q
  return undefined
}

function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function intOrNull(v: unknown): number | null {
  const n = numberOrNull(v)
  return n === null ? null : Math.round(n)
}

export function registerSoldPropertyRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  // List with filters
  app.get('/sold-properties', async (c) => {
    const repo = new D1SoldPropertyRepository(c.env.DB)
    const uc = new ListSoldPropertiesUseCase(repo)
    const q = c.req.query()
    const items = await uc.execute(c.get('orgId'), {
      origin: originFromQuery(q.origin),
      currentUserId: c.get('userId'),
      property_type: q.property_type || null,
      neighborhood: q.neighborhood || null,
      min_covered_area: numberOrNull(q.min_covered_area),
      max_covered_area: numberOrNull(q.max_covered_area),
      closed_after: q.closed_after || null,
      closed_before: q.closed_before || null,
      search: q.search || null,
      limit: numberOrNull(q.limit) ?? 100,
      offset: numberOrNull(q.offset) ?? 0,
    })
    const userId = c.get('userId')
    return c.json(items.map(sp => {
      const o = sp.toObject()
      return { ...o, origin: sp.originFor(userId), usd_per_m2: sp.usdPerM2 }
    }))
  })

  app.get('/sold-properties/:id', async (c) => {
    const repo = new D1SoldPropertyRepository(c.env.DB)
    const uc = new GetSoldPropertyUseCase(repo)
    try {
      const sp = await uc.execute(c.req.param('id'), c.get('orgId'))
      const o = sp.toObject()
      return c.json({ ...o, origin: sp.originFor(c.get('userId')), usd_per_m2: sp.usdPerM2 })
    } catch (e: any) {
      if (e?.statusCode === 404) return c.json({ error: 'Not found' }, 404)
      throw e
    }
  })

  app.post('/sold-properties', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1SoldPropertyRepository(c.env.DB)
    const uc = new CreateSoldPropertyUseCase(repo, new CryptoIdGenerator())
    const result = await uc.execute({
      org_id: c.get('orgId'),
      created_by: c.get('userId'),
      property_type: body.property_type,
      neighborhood: body.neighborhood ?? null,
      address_approx: body.address_approx ?? null,
      covered_area: numberOrNull(body.covered_area),
      total_area: numberOrNull(body.total_area),
      semi_area: numberOrNull(body.semi_area),
      rooms: intOrNull(body.rooms),
      bedrooms: intOrNull(body.bedrooms),
      bathrooms: intOrNull(body.bathrooms),
      parking: intOrNull(body.parking),
      listing_price_usd: numberOrNull(body.listing_price_usd),
      closing_price_usd: numberOrNull(body.closing_price_usd),
      closed_at: body.closed_at ?? null,
      notes: body.notes ?? null,
      agent_id: body.agent_id ?? null,
      external_agent_name: body.external_agent_name ?? null,
      external_agency: body.external_agency ?? null,
      photos: Array.isArray(body.photos) ? body.photos : [],
      shared_with_network: !!body.shared_with_network,
    })
    return c.json(result, 201)
  })

  app.put('/sold-properties/:id', async (c) => {
    const body = (await c.req.json()) as any
    const repo = new D1SoldPropertyRepository(c.env.DB)
    const uc = new UpdateSoldPropertyUseCase(repo)
    try {
      await uc.execute(c.req.param('id'), c.get('orgId'), {
        property_type: body.property_type,
        neighborhood: body.neighborhood ?? null,
        address_approx: body.address_approx ?? null,
        covered_area: numberOrNull(body.covered_area),
        total_area: numberOrNull(body.total_area),
        semi_area: numberOrNull(body.semi_area),
        rooms: intOrNull(body.rooms),
        bedrooms: intOrNull(body.bedrooms),
        bathrooms: intOrNull(body.bathrooms),
        parking: intOrNull(body.parking),
        listing_price_usd: numberOrNull(body.listing_price_usd),
        closing_price_usd: numberOrNull(body.closing_price_usd),
        closed_at: body.closed_at ?? null,
        notes: body.notes ?? null,
        agent_id: body.agent_id ?? null,
        external_agent_name: body.external_agent_name ?? null,
        external_agency: body.external_agency ?? null,
        photos: Array.isArray(body.photos) ? body.photos : undefined,
        shared_with_network: typeof body.shared_with_network === 'boolean' ? body.shared_with_network : undefined,
      })
      return c.json({ success: true })
    } catch (e: any) {
      if (e?.statusCode === 404) return c.json({ error: 'Not found' }, 404)
      throw e
    }
  })

  app.delete('/sold-properties/:id', async (c) => {
    const repo = new D1SoldPropertyRepository(c.env.DB)
    const uc = new DeleteSoldPropertyUseCase(repo)
    await uc.execute(c.req.param('id'), c.get('orgId'))
    return c.json({ success: true })
  })

  app.post('/sold-properties/:id/photos', async (c) => {
    const body = (await c.req.json()) as any
    const url = body?.url as string
    if (!url) return c.json({ error: 'url requerido' }, 400)
    const repo = new D1SoldPropertyRepository(c.env.DB)
    const uc = new AddSoldPropertyPhotoUseCase(repo)
    try {
      await uc.execute(c.req.param('id'), c.get('orgId'), url)
      return c.json({ success: true })
    } catch (e: any) {
      if (e?.statusCode === 404) return c.json({ error: 'Not found' }, 404)
      throw e
    }
  })

  app.delete('/sold-properties/:id/photos', async (c) => {
    const url = c.req.query('url')
    if (!url) return c.json({ error: 'url query param requerido' }, 400)
    const repo = new D1SoldPropertyRepository(c.env.DB)
    const uc = new RemoveSoldPropertyPhotoUseCase(repo)
    try {
      await uc.execute(c.req.param('id'), c.get('orgId'), url)
      return c.json({ success: true })
    } catch (e: any) {
      if (e?.statusCode === 404) return c.json({ error: 'Not found' }, 404)
      throw e
    }
  })
}
