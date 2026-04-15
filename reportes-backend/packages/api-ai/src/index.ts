import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, JwtAuthService, GroqAIService, AnthropicAIService } from '@vendepro/infrastructure'

type Env = { DB: D1Database; JWT_SECRET: string; GROQ_API_KEY: string; ANTHROPIC_API_KEY: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.use('*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

app.post('/ai/process', async (c) => {
  const body = (await c.req.json()) as any
  const service = new GroqAIService(c.env.GROQ_API_KEY)
  const intent = await service.extractLeadIntent(body.text || body.message)
  return c.json({ intent })
})

app.post('/ai/transcribe', async (c) => {
  const formData = await c.req.formData()
  const audioFile = formData.get('audio') as File | null
  if (!audioFile) return c.json({ error: 'No audio file provided' }, 400)
  const buffer = await audioFile.arrayBuffer()
  const service = new GroqAIService(c.env.GROQ_API_KEY)
  const text = await service.transcribeAudio(buffer, audioFile.type)
  return c.json({ text })
})

app.post('/ai/confirm', async (c) => {
  // Confirm and save extracted lead intent to DB
  const body = (await c.req.json()) as any
  // The frontend confirms after /ai/process — this endpoint just returns success
  // Actual saving happens via api-crm /leads POST
  return c.json({ confirmed: true, intent: body.intent })
})

app.post('/extract-metrics', async (c) => {
  const body = (await c.req.json()) as any
  const service = new AnthropicAIService(c.env.ANTHROPIC_API_KEY)
  const metrics = await service.extractMetricsFromScreenshot(body.imageBase64 || body.image)
  return c.json({ metrics })
})

export default app
