import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, JwtAuthService, AnthropicAIService, D1LandingRepository, GroqAIService, AnthropicEmailContentGenerator, D1OrganizationRepository } from '@vendepro/infrastructure'
import {
  ExtractPropertyMetricsUseCase,
  ExtractComparableFromScreenshotUseCase,
  ExtractLeadFromTextUseCase,
  ExtractLeadFromImageUseCase,
  EditBlockWithAIUseCase,
  GenerateEmailCampaignContentUseCase,
  GenerateAutomationSequenceUseCase,
} from '@vendepro/core'

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

app.post('/extract-entity', async (c) => {
  const body = (await c.req.json()) as any
  const useCase = new ExtractLeadFromTextUseCase(new GroqAIService(c.env.GROQ_API_KEY))
  try {
    const fields = await useCase.execute({ text: body.text ?? '' })
    return c.json({ fields })
  } catch (e: any) {
    if (e.statusCode === 400 || e.statusCode === 413) return c.json({ error: e.message }, e.statusCode)
    throw e
  }
})

app.post('/extract-comparable', async (c) => {
  const body = (await c.req.json()) as any
  const ai = new AnthropicAIService(c.env.ANTHROPIC_API_KEY)
  const useCase = new ExtractComparableFromScreenshotUseCase(ai)
  try {
    const fields = await useCase.execute({
      imageBase64: body.imageBase64 || body.image || '',
      mimeType: body.mimeType,
    })
    return c.json({ fields })
  } catch (e: any) {
    if (typeof e?.statusCode === 'number') return c.json({ error: e.message }, e.statusCode)
    throw e
  }
})

// Genera el borrador de una campaña de email marketing con IA.
// Usa nombre y color de marca de la org para que el HTML salga brandeado.
app.post('/generate-email-campaign', async (c) => {
  const body = (await c.req.json()) as any
  const org = await new D1OrganizationRepository(c.env.DB).findById(c.get('orgId'))
  const useCase = new GenerateEmailCampaignContentUseCase(
    new AnthropicEmailContentGenerator(c.env.ANTHROPIC_API_KEY),
  )
  const content = await useCase.execute({
    brief: body.brief ?? '',
    kind: body.kind,
    orgName: org?.name ?? null,
    audienceDescription: body.audience_description ?? null,
    brandColor: org?.brand_color ?? null,
  })
  return c.json(content)
})

// Genera una secuencia coordinada de emails (automatización drip) con IA.
app.post('/generate-email-sequence', async (c) => {
  const body = (await c.req.json()) as any
  const org = await new D1OrganizationRepository(c.env.DB).findById(c.get('orgId'))
  const useCase = new GenerateAutomationSequenceUseCase(
    new AnthropicEmailContentGenerator(c.env.ANTHROPIC_API_KEY),
  )
  const steps = await useCase.execute({
    brief: body.brief ?? '',
    stepCount: body.step_count ?? 3,
    orgName: org?.name ?? null,
    audienceDescription: body.audience_description ?? null,
    brandColor: org?.brand_color ?? null,
  })
  return c.json({ steps })
})

app.post('/extract-image', async (c) => {
  const body = (await c.req.json()) as any
  const useCase = new ExtractLeadFromImageUseCase(new GroqAIService(c.env.GROQ_API_KEY))
  try {
    const fields = await useCase.execute({ imageBase64: body.imageBase64 ?? '', mimeType: body.mimeType })
    return c.json({ fields })
  } catch (e: any) {
    if (e.statusCode === 400 || e.statusCode === 413) return c.json({ error: e.message }, e.statusCode)
    throw e
  }
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
