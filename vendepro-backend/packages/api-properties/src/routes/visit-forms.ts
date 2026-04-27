import type { Hono } from 'hono'
import {
  D1PropertyVisitFormRepository,
  D1PropertyRepository,
  CryptoIdGenerator,
} from '@vendepro/infrastructure'
import {
  GenerateVisitFormLinkUseCase,
  ListVisitFormsByPropertyUseCase,
  ArchiveVisitFormUseCase,
  DeleteVisitFormUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string; BROWSER: Fetcher; API_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

export function registerVisitFormRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  // ── Generate visit form link (auth) ──────────────────────────
  // POST /visit-forms/generate  { property_id }  → { id, slug, public_url }
  app.post('/visit-forms/generate', async (c) => {
    const body = (await c.req.json()) as any
    if (!body?.property_id) {
      return c.json({ error: 'property_id requerido' }, 400)
    }
    const repo = new D1PropertyVisitFormRepository(c.env.DB)
    const propRepo = new D1PropertyRepository(c.env.DB)
    const uc = new GenerateVisitFormLinkUseCase(repo, propRepo, new CryptoIdGenerator())
    try {
      const result = await uc.execute({
        org_id: c.get('orgId'),
        agent_id: c.get('userId'),
        property_id: body.property_id,
      })
      return c.json(
        {
          id: result.id,
          slug: result.slug,
          public_url: `/v/${result.slug}`,
        },
        201,
      )
    } catch (e: any) {
      if (e?.httpStatus === 404 || e?.statusCode === 404) {
        return c.json({ error: 'Propiedad no encontrada' }, 404)
      }
      throw e
    }
  })

  // ── List visit forms for a property (auth) ───────────────────
  // GET /visit-forms?property_id=X[&include_archived=1]  → array
  app.get('/visit-forms', async (c) => {
    const propertyId = c.req.query('property_id')
    if (!propertyId) {
      return c.json({ error: 'property_id requerido' }, 400)
    }
    const includeArchived = c.req.query('include_archived') === '1'
    const repo = new D1PropertyVisitFormRepository(c.env.DB)
    const uc = new ListVisitFormsByPropertyUseCase(repo)
    const items = await uc.execute(propertyId, c.get('orgId'))
    const filtered = includeArchived
      ? items
      : items.filter((f) => f.archived_at === null)
    return c.json(filtered.map((f) => f.toObject()))
  })

  // ── Archive / unarchive (auth) ───────────────────────────────
  // PATCH /visit-forms/:id/archive  { archived: boolean }
  app.patch('/visit-forms/:id/archive', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const archived = body?.archived !== false
    const repo = new D1PropertyVisitFormRepository(c.env.DB)
    const uc = new ArchiveVisitFormUseCase(repo)
    try {
      await uc.execute({
        id: c.req.param('id'),
        org_id: c.get('orgId'),
        archived,
      })
      return c.json({ success: true, archived })
    } catch (e: any) {
      if (e?.httpStatus === 404 || e?.statusCode === 404) {
        return c.json({ error: 'Ficha no encontrada' }, 404)
      }
      throw e
    }
  })

  // ── Soft delete (auth) ───────────────────────────────────────
  // DELETE /visit-forms/:id
  app.delete('/visit-forms/:id', async (c) => {
    const repo = new D1PropertyVisitFormRepository(c.env.DB)
    const uc = new DeleteVisitFormUseCase(repo)
    try {
      await uc.execute({ id: c.req.param('id'), org_id: c.get('orgId') })
      return c.json({ success: true })
    } catch (e: any) {
      if (e?.httpStatus === 404 || e?.statusCode === 404) {
        return c.json({ error: 'Ficha no encontrada' }, 404)
      }
      throw e
    }
  })
}
