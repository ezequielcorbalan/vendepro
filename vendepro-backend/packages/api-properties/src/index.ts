import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, JwtAuthService } from '@vendepro/infrastructure'
import { registerPropertyRoutes } from './routes/properties'
import { registerPhotoRoutes } from './routes/photos'
import { registerAppraisalRoutes } from './routes/appraisals'
import { registerPrefactibilidadRoutes } from './routes/prefactibilidades'
import { registerReportRoutes } from './routes/reports'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
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
registerReportRoutes(app)

export default app
