import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, JwtAuthService, AnthropicAIService } from '@vendepro/infrastructure'
import { ExtractPropertyMetricsUseCase } from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; ANTHROPIC_API_KEY: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.use('*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

app.post('/extract-metrics', async (c) => {
  const body = (await c.req.json()) as any
  const ai = new AnthropicAIService(c.env.ANTHROPIC_API_KEY)
  const useCase = new ExtractPropertyMetricsUseCase(ai)
  const metrics = await useCase.execute({ imageBase64: body.imageBase64 || body.image })
  return c.json({ metrics })
})

export default app
