import type { Hono } from 'hono'
import {
  D1FichaLinkRepository,
  D1LeadRepository,
  CryptoIdGenerator,
} from '@vendepro/infrastructure'
import {
  GenerateFichaLinkUseCase,
  ListFichaLinksUseCase,
  ArchiveFichaLinkUseCase,
  DeleteFichaLinkUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string; BROWSER: Fetcher; API_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

// Chequeo inline como en api-crm: `canManageOrg` está exportado dos veces desde
// @vendepro/core (domain/rules y shared/crm-config) y esbuild rechaza el import
// ambiguo al bundlear el worker.
const canManageOrg = (role: string) => role === 'admin' || role === 'owner'

/**
 * Links públicos de Ficha de Tasación (/f/<slug>). El propietario los completa
 * desde el celular y el envío entra al CRM como lead + ficha + tasación.
 */
export function registerFichaLinkRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  // ── Generar link ─────────────────────────────────────────────
  // POST /ficha-links  { mode: 'single'|'open', lead_id?, label?, institutional? }
  //   → { id, slug, mode, reused, public_url }
  app.post('/ficha-links', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const mode = body?.mode === 'open' ? 'open' : 'single'

    // El link institucional habla en nombre de la inmobiliaria y sus envíos
    // caen en el admin: sólo un admin puede crearlo.
    const institutional = mode === 'open' && body?.institutional === true
    if (institutional && !canManageOrg(c.get('userRole'))) {
      return c.json({ error: 'Sólo un administrador puede crear el link institucional' }, 403)
    }

    const uc = new GenerateFichaLinkUseCase(
      new D1FichaLinkRepository(c.env.DB),
      new CryptoIdGenerator(),
      new D1LeadRepository(c.env.DB),
    )
    const result = await uc.execute({
      org_id: c.get('orgId'),
      agent_id: c.get('userId'),
      mode,
      lead_id: typeof body?.lead_id === 'string' && body.lead_id ? body.lead_id : null,
      label: typeof body?.label === 'string' && body.label.trim() ? body.label.trim() : null,
      institutional,
    })

    return c.json(
      { ...result, public_url: `/f/${result.slug}` },
      // Reusar el link abierto existente no es una creación.
      result.reused ? 200 : 201,
    )
  })

  // ── Listar links ─────────────────────────────────────────────
  // GET /ficha-links?mode=open&lead_id=X&agent_id=Y&include_archived=1
  app.get('/ficha-links', async (c) => {
    const uc = new ListFichaLinksUseCase(new D1FichaLinkRepository(c.env.DB))
    const modeParam = c.req.query('mode')
    const items = await uc.execute(c.get('orgId'), {
      mode: modeParam === 'open' || modeParam === 'single' ? modeParam : undefined,
      lead_id: c.req.query('lead_id') || undefined,
      agent_id: c.req.query('agent_id') || undefined,
      include_archived: c.req.query('include_archived') === '1',
    })
    return c.json(
      items.map((l) => ({ ...l.toObject(), public_url: `/f/${l.slug}` })),
    )
  })

  // ── Archivar / desarchivar ───────────────────────────────────
  // PATCH /ficha-links/:id/archive  { archived: boolean }
  app.patch('/ficha-links/:id/archive', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const archived = body?.archived !== false
    const uc = new ArchiveFichaLinkUseCase(new D1FichaLinkRepository(c.env.DB))
    await uc.execute({ id: c.req.param('id'), org_id: c.get('orgId'), archived })
    return c.json({ success: true, archived })
  })

  // ── Borrar ───────────────────────────────────────────────────
  app.delete('/ficha-links/:id', async (c) => {
    const uc = new DeleteFichaLinkUseCase(new D1FichaLinkRepository(c.env.DB))
    await uc.execute(c.req.param('id'), c.get('orgId'))
    return c.json({ success: true })
  })
}
