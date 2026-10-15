import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, JwtAuthService } from '@vendepro/infrastructure'
import { registerPropertyRoutes } from './routes/properties'
import { registerPhotoRoutes } from './routes/photos'
import { registerAppraisalRoutes } from './routes/appraisals'
import { registerPrefactibilidadRoutes } from './routes/prefactibilidades'
import { registerFichaRoutes } from './routes/fichas'
import { registerFichaLinkRoutes } from './routes/ficha-links'
import { registerReportRoutes } from './routes/reports'
import { registerVisitFormRoutes } from './routes/visit-forms'
import { registerLandingTemplateRoutes } from './routes/landings'
import { registerSoldPropertyRoutes } from './routes/sold-properties'
import { registerDocPortalRoutes } from './routes/doc-portal'
import { registerDocDriveRoutes } from './routes/doc-drive'
import { runDriveDocumentsSync } from '@vendepro/infrastructure'

type Env = {
  DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string; BROWSER: Fetcher; API_PUBLIC_URL: string
  GOOGLE_DRIVE_SA_KEY?: string
  GEMINI_API_KEY?: string
}
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

// Apply auth to all routes except public photo proxy
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/photo/')) return next()
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

registerPropertyRoutes(app)
registerPhotoRoutes(app)
registerAppraisalRoutes(app)
registerPrefactibilidadRoutes(app)
registerFichaRoutes(app)
registerFichaLinkRoutes(app)
registerReportRoutes(app)
registerVisitFormRoutes(app)
registerLandingTemplateRoutes(app)
registerSoldPropertyRoutes(app)
registerDocPortalRoutes(app)
registerDocDriveRoutes(app)

/**
 * Cron diario (wrangler.jsonc, 07:00 UTC = 04:00 en Argentina, fuera del horario
 * de trabajo): barrido de las unidades de Drive de documentación → checklist de
 * cada propiedad. Plan: doc/documentacion-drive-plan.md.
 */
async function scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil(runDriveDocumentsSync(env))
}

// El default sigue siendo la app de Hono (los tests usan app.request) con el
// handler `scheduled` adosado: wrangler resuelve default.fetch y default.scheduled.
export default Object.assign(app, { scheduled })
