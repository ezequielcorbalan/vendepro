import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, JwtAuthService, AnthropicAIService, D1LandingRepository, GroqAIService } from '@vendepro/infrastructure'
import { ExtractPropertyMetricsUseCase, EditBlockWithAIUseCase } from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; ANTHROPIC_API_KEY: string; GROQ_API_KEY: string }
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

app.post('/landings/:id/edit-block', async (c) => {
  const body = (await c.req.json()) as any
  const landings = new D1LandingRepository(c.env.DB)
  const ai = new GroqAIService(c.env.GROQ_API_KEY)
  const uc = new EditBlockWithAIUseCase(landings, ai)
  const result = await uc.execute({
    actor: { role: c.get('userRole') as any, userId: c.get('userId') as string },
    orgId: c.get('orgId') as string,
    landingId: c.req.param('id'),
    prompt: body.prompt,
    scope: body.scope,
    blockId: body.blockId,
  })
  return c.json(result)
})

export default app
