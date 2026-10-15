import type { Hono } from 'hono'
import {
  D1DriveFolderRepository,
  D1PropertyRepository,
  D1OrgIntegrationRepository,
  CryptoIdGenerator,
  createDriveDocumentsSync,
  driveServiceAccountEmail,
} from '@vendepro/infrastructure'
import {
  GetDriveDocsSettingsUseCase,
  SaveDriveDocsSettingsUseCase,
  ListDriveFoldersUseCase,
  LinkDriveFolderUseCase,
  SyncPropertyDriveDocumentsUseCase,
  ValidationError,
} from '@vendepro/core'
import type { DriveFolderMatchStatus } from '@vendepro/core'

type Env = {
  DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string; BROWSER: Fetcher; API_PUBLIC_URL: string
  /** JSON de la clave de la cuenta de servicio (sólo lectura) que lee las unidades de documentación. */
  GOOGLE_DRIVE_SA_KEY?: string
  GEMINI_API_KEY?: string
}

type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const FOLDER_STATUSES: DriveFolderMatchStatus[] = ['auto', 'manual', 'ambiguous', 'none', 'ignored']

/**
 * Checklist de documentación leído desde Drive. Plan: doc/documentacion-drive-plan.md.
 * El barrido nocturno corre en el `scheduled` de este worker; estas rutas son
 * la configuración, la bandeja de carpetas sin asignar y el "Revisar ahora".
 */
export function registerDocDriveRoutes(app: Hono<{ Bindings: Env } & AuthVars>) {
  // GET /doc-drive/settings → config de la org + mail de la cuenta de servicio
  // (lo que hay que agregar como Lector de la unidad compartida).
  app.get('/doc-drive/settings', async (c) => {
    const uc = new GetDriveDocsSettingsUseCase(new D1OrgIntegrationRepository(c.env.DB))
    return c.json({
      ...(await uc.execute(c.get('orgId'))),
      service_account_email: driveServiceAccountEmail(c.env),
      ai_enabled: !!c.env.GEMINI_API_KEY,
    })
  })

  // PUT /doc-drive/settings  { enabled, shared_drive_id, read_only, ignore[] }  (admin)
  app.put('/doc-drive/settings', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const uc = new SaveDriveDocsSettingsUseCase(new D1OrgIntegrationRepository(c.env.DB), new CryptoIdGenerator())
    return c.json(
      await uc.execute({
        org_id: c.get('orgId'),
        role: c.get('userRole'),
        enabled: body?.enabled === true,
        shared_drive_id: typeof body?.shared_drive_id === 'string' ? body.shared_drive_id : '',
        read_only: body?.read_only !== false,
        ignore: Array.isArray(body?.ignore) ? body.ignore : [],
      }),
    )
  })

  // GET /doc-drive/folders?status=ambiguous → carpetas leídas, con la propiedad vinculada.
  app.get('/doc-drive/folders', async (c) => {
    const status = c.req.query('status') as DriveFolderMatchStatus | undefined
    const uc = new ListDriveFoldersUseCase(new D1DriveFolderRepository(c.env.DB), new D1PropertyRepository(c.env.DB))
    const folders = await uc.execute(c.get('orgId'), status && FOLDER_STATUSES.includes(status) ? status : undefined)
    return c.json({ folders })
  })

  // PUT /doc-drive/folders/:folderId  { property_id | null, ignore? }  (admin)
  app.put('/doc-drive/folders/:folderId', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as any
    const uc = new LinkDriveFolderUseCase(new D1DriveFolderRepository(c.env.DB), new D1PropertyRepository(c.env.DB))
    return c.json(
      await uc.execute({
        org_id: c.get('orgId'),
        role: c.get('userRole'),
        folder_id: c.req.param('folderId'),
        property_id: typeof body?.property_id === 'string' && body.property_id ? body.property_id : null,
        ignore: body?.ignore === true,
      }),
    )
  })

  // POST /properties/:id/documents/sync → "Revisar carpeta ahora" desde la ficha.
  app.post('/properties/:id/documents/sync', async (c) => {
    const sync = createDriveDocumentsSync(c.env)
    if (!sync) throw new ValidationError('La lectura de Drive no está configurada en el servidor')
    const uc = new SyncPropertyDriveDocumentsUseCase(new D1PropertyRepository(c.env.DB), sync)
    const result = await uc.execute(
      { org_id: c.get('orgId'), user_id: c.get('userId'), role: c.get('userRole') },
      c.req.param('id'),
    )
    return c.json(result)
  })
}
