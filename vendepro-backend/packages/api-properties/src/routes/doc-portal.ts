import type { Hono } from 'hono'
import {
  D1DocPortalLinkRepository,
  D1PropertyDocumentRepository,
  D1PropertyRepository,
  D1OrgIntegrationRepository,
  CryptoIdGenerator,
} from '@vendepro/infrastructure'
import {
  CreateDocPortalLinkUseCase,
  RevokeDocPortalLinkUseCase,
  GetPropertyDocumentsUseCase,
  GetDocsIntegrationSettingsUseCase,
  SaveDocsIntegrationSettingsUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string; BROWSER: Fetcher; API_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const MARRIED = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null)

/**
 * Portal de documentación del propietario (/d/<token>). El propietario sube los
 * papeles; api-public los reenvía a n8n y deja el registro en D1.
 */
export function registerDocPortalRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  const actorOf = (c: any) => ({ org_id: c.get('orgId'), user_id: c.get('userId'), role: c.get('userRole') })

  // GET /properties/:id/documents → { enabled, link, checklist, documents }
  app.get('/properties/:id/documents', async (c) => {
    const db = c.env.DB
    const uc = new GetPropertyDocumentsUseCase(
      new D1DocPortalLinkRepository(db),
      new D1PropertyDocumentRepository(db),
      new D1PropertyRepository(db),
      new D1OrgIntegrationRepository(db),
    )
    const view = await uc.execute(actorOf(c), c.req.param('id'))
    return c.json({
      ...view,
      link: view.link ? { ...view.link, public_url: `/d/${view.link.token}` } : null,
    })
  })

  // POST /properties/:id/doc-portal-link  { operation?, property_kind?, succession?, married? }
  // Regenerar = revocar el anterior y crear uno nuevo.
  app.post('/properties/:id/doc-portal-link', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const db = c.env.DB
    const uc = new CreateDocPortalLinkUseCase(
      new D1DocPortalLinkRepository(db),
      new D1PropertyRepository(db),
      new D1OrgIntegrationRepository(db),
      new CryptoIdGenerator(),
    )
    const link = await uc.execute({
      actor: actorOf(c),
      property_id: c.req.param('id'),
      operation: body?.operation ?? null,
      property_kind: body?.property_kind ?? null,
      succession: body?.succession ?? null,
      married: MARRIED(body?.married),
    })
    return c.json({ ...link, public_url: `/d/${link.token}` }, 201)
  })

  app.delete('/properties/:id/doc-portal-link', async (c) => {
    const db = c.env.DB
    const uc = new RevokeDocPortalLinkUseCase(new D1DocPortalLinkRepository(db), new D1PropertyRepository(db))
    return c.json(await uc.execute(actorOf(c), c.req.param('id')))
  })

  // ── Configuración de la org (admin) ──────────────────────────
  app.get('/doc-portal/settings', async (c) => {
    const uc = new GetDocsIntegrationSettingsUseCase(new D1OrgIntegrationRepository(c.env.DB))
    return c.json(await uc.execute(c.get('orgId')))
  })

  // PUT /doc-portal/settings  { enabled, upload_url, done_url, agent_map: { user_id: 'andres' } }
  app.put('/doc-portal/settings', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const uc = new SaveDocsIntegrationSettingsUseCase(new D1OrgIntegrationRepository(c.env.DB), new CryptoIdGenerator())
    return c.json(
      await uc.execute({
        org_id: c.get('orgId'),
        role: c.get('userRole'),
        enabled: body?.enabled === true,
        upload_url: typeof body?.upload_url === 'string' ? body.upload_url : '',
        done_url: typeof body?.done_url === 'string' ? body.done_url : '',
        agent_map: body?.agent_map && typeof body.agent_map === 'object' ? body.agent_map : {},
      }),
    )
  })
}
