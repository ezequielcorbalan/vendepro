import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, JwtAuthService, D1LandingRepository, GeminiAIService, GeminiEmailContentGenerator, D1OrganizationRepository } from '@vendepro/infrastructure'
import {
  ExtractPropertyMetricsUseCase,
  ExtractComparableFromScreenshotUseCase,
  ExtractLeadFromTextUseCase,
  ExtractLeadFromImageUseCase,
  EditBlockWithAIUseCase,
  GenerateEmailCampaignContentUseCase,
  GenerateAutomationSequenceUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; GEMINI_API_KEY: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.use('*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

app.post('/extract-metrics', async (c) => {
  const body = (await c.req.json()) as any
  const ai = new GeminiAIService(c.env.GEMINI_API_KEY)
  const useCase = new ExtractPropertyMetricsUseCase(ai)
  try {
    const metrics = await useCase.execute({
      imageBase64: body.imageBase64 || body.image || '',
      mimeType: body.mimeType,
    })
    return c.json({ metrics })
  } catch (e: any) {
    // Mismo patron que extract-comparable: sin esto cualquier fallo del
    // proveedor salia como un 500 mudo y el front mostraba "cargalos a mano".
    if (typeof e?.statusCode === 'number') return c.json({ error: e.message }, e.statusCode)
    throw e
  }
})

app.post('/extract-entity', async (c) => {
  const body = (await c.req.json()) as any
  const useCase = new ExtractLeadFromTextUseCase(new GeminiAIService(c.env.GEMINI_API_KEY))
  try {
    const fields = await useCase.execute({ text: body.text ?? '' })
    return c.json({ fields })
  } catch (e: any) {
    if (typeof e?.statusCode === 'number') return c.json({ error: e.message }, e.statusCode)
    throw e
  }
})

app.post('/extract-comparable', async (c) => {
  const body = (await c.req.json()) as any
  const ai = new GeminiAIService(c.env.GEMINI_API_KEY)
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
    new GeminiEmailContentGenerator(c.env.GEMINI_API_KEY),
  )
  try {
    const content = await useCase.execute({
      brief: body.brief ?? '',
      kind: body.kind,
      orgName: org?.name ?? null,
      audienceDescription: body.audience_description ?? null,
      brandColor: org?.brand_color ?? null,
    })
    return c.json(content)
  } catch (e: any) {
    if (typeof e?.statusCode === 'number') return c.json({ error: e.message }, e.statusCode)
    throw e
  }
})

// Genera una secuencia coordinada de emails (automatización drip) con IA.
app.post('/generate-email-sequence', async (c) => {
  const body = (await c.req.json()) as any
  const org = await new D1OrganizationRepository(c.env.DB).findById(c.get('orgId'))
  const useCase = new GenerateAutomationSequenceUseCase(
    new GeminiEmailContentGenerator(c.env.GEMINI_API_KEY),
  )
  try {
    const steps = await useCase.execute({
      brief: body.brief ?? '',
      stepCount: body.step_count ?? 3,
      orgName: org?.name ?? null,
      audienceDescription: body.audience_description ?? null,
      brandColor: org?.brand_color ?? null,
    })
    return c.json({ steps })
  } catch (e: any) {
    if (typeof e?.statusCode === 'number') return c.json({ error: e.message }, e.statusCode)
    throw e
  }
})

app.post('/extract-image', async (c) => {
  const body = (await c.req.json()) as any
  const useCase = new ExtractLeadFromImageUseCase(new GeminiAIService(c.env.GEMINI_API_KEY))
  try {
    const fields = await useCase.execute({ imageBase64: body.imageBase64 ?? '', mimeType: body.mimeType })
    return c.json({ fields })
  } catch (e: any) {
    if (typeof e?.statusCode === 'number') return c.json({ error: e.message }, e.statusCode)
    throw e
  }
})

// Este endpoint solo genera y devuelve una propuesta (EditBlockWithAIUseCase no
// persiste nada). El frontend recién escribe el `data` propuesto cuando el
// agente acepta (ver AIChatPanel.tsx → accept()), sin filtrar campos bindeados.
// Eso está bien: si el bloque tiene binding='agent_profile', el valor que la
// IA haya pisado en un campo bindeado (ver AGENT_BINDINGS) queda igual
// sobreescrito por el perfil del agente en la lectura pública
// (resolveAgentBindings, invocado desde GetPublicAgentLandingUseCase). No hace
// falta lógica extra acá — el binding se resuelve en lectura, no en escritura.
app.post('/landings/:id/edit-block', async (c) => {
  const body = (await c.req.json()) as any
  const landings = new D1LandingRepository(c.env.DB)
  let ai: GeminiAIService
  try {
    ai = new GeminiAIService(c.env.GEMINI_API_KEY)
  } catch (e: any) {
    // El guard de key tira 503 desde el constructor. Sin este catch se escapaba
    // al errorHandler y salia como 500 mudo.
    if (typeof e?.statusCode === 'number') return c.json({ error: e.message }, e.statusCode)
    throw e
  }
  const uc = new EditBlockWithAIUseCase(landings, ai)
  const result = await uc.execute({
    actor: { role: c.get('userRole') as any, userId: c.get('userId') as string },
    orgId: c.get('orgId') as string,
    landingId: c.req.param('id'),
    prompt: body.prompt,
    scope: body.scope,
    blockId: body.blockId,
  })
  // El use case devuelve un union {status:'ok'|'error'} y esto responde 200 aun
  // cuando fallo. Se mantiene a proposito: el front lee `reason` del body y
  // muestra un mensaje util (landings/AIChatPanel.tsx -> friendlyError), y su
  // helper `json()` tira excepcion con cualquier status !=2xx, asi que devolver
  // 502 degradaria el mensaje a "Error de red: 502".
  // El costo del 200 es que el fallo no se ve en metricas por status; se
  // compensa logueandolo, que es lo que `wrangler tail` necesita.
  if (result.status === 'error') {
    console.error(`[edit-block] ${result.reason}${result.detail ? `: ${result.detail}` : ''}`)
  }
  return c.json(result)
})

export default app
