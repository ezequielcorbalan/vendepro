import { Hono } from 'hono'
import { corsMiddleware, errorHandler } from '@vendepro/infrastructure'
import {
  D1PropertyRepository,
  D1ReportRepository,
  D1AppraisalRepository,
  D1TemplateBlockRepository,
  D1VisitFormRepository,
  D1PropertyVisitFormRepository,
  D1PrefactibilidadRepository,
  D1OrganizationRepository,
  D1UserRepository,
  D1ContactRepository,
  D1LeadRepository,
  CryptoIdGenerator,
  D1LandingRepository,
  D1LandingVersionRepository,
  D1LandingEventRepository,
  fireMarketingEvent,
} from '@vendepro/infrastructure'
import {
  GetPublicReportUseCase,
  GetPublicAppraisalUseCase,
  GetPublicVisitFormUseCase,
  SubmitVisitFormResponseUseCase,
  GetVisitFormBySlugUseCase,
  SubmitVisitFormUseCase,
  GetPublicPrefactibilidadUseCase,
  CreatePublicLeadUseCase,
  GetPublicLandingUseCase,
  RecordLandingEventUseCase,
  SubmitLeadFromLandingUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string }

const app = new Hono<{ Bindings: Env }>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

// ── PUBLIC REPORT (/r/:slug) ───────────────────────────────────
app.get('/public/report/:slug', async (c) => {
  const uc = new GetPublicReportUseCase(
    new D1PropertyRepository(c.env.DB),
    new D1ReportRepository(c.env.DB),
  )
  const result = await uc.execute(c.req.param('slug'))
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

// ── PUBLIC APPRAISAL (/t/:slug) ────────────────────────────────
app.get('/public/appraisal/:slug', async (c) => {
  const uc = new GetPublicAppraisalUseCase(
    new D1AppraisalRepository(c.env.DB),
    new D1TemplateBlockRepository(c.env.DB),
  )
  const result = await uc.execute(c.req.param('slug'))
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

// ── PUBLIC VISIT FORM GET (/v/:slug) ───────────────────────────
app.get('/public/visit-form/:slug', async (c) => {
  const uc = new GetPublicVisitFormUseCase(
    new D1VisitFormRepository(c.env.DB),
  )
  const result = await uc.execute(c.req.param('slug'))
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

// ── PUBLIC VISIT FORM SUBMIT (/v/:slug) ───────────────────────
app.post('/public/visit-form/:slug', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new SubmitVisitFormResponseUseCase(
    new D1VisitFormRepository(c.env.DB),
    new CryptoIdGenerator(),
  )
  const result = await uc.execute({
    slug: c.req.param('slug'),
    visitor_name: body.name ?? body.visitor_name,
    visitor_phone: body.phone ?? body.visitor_phone ?? null,
    visitor_email: body.email ?? body.visitor_email ?? null,
    responses: body.responses ?? {},
  })
  return c.json(result, 201)
})

// ── FICHA DE VISITA (/v/:slug) — nuevo modelo simple ───────────
// Público: obtiene ficha + datos de la propiedad para pre-poblar el form.
app.get('/public/property-visit-form/:slug', async (c) => {
  const uc = new GetVisitFormBySlugUseCase(
    new D1PropertyVisitFormRepository(c.env.DB),
  )
  const result = await uc.execute(c.req.param('slug'))
  if (!result) return c.json({ error: 'Not found' }, 404)

  const formObj = result.form.toObject()
  return c.json({
    slug: formObj.slug,
    submitted: formObj.submitted_at !== null,
    property: result.property,
    org: result.org,
    // Si ya fue submitted, podemos mostrar read-only con las respuestas.
    response: formObj.submitted_at
      ? {
          visitor_name: formObj.visitor_name,
          visitor_email: formObj.visitor_email,
          visitor_phone: formObj.visitor_phone,
          liked: formObj.liked,
          disliked: formObj.disliked,
          subjective_price_usd: formObj.subjective_price_usd,
          buy_intention: formObj.buy_intention,
          observations: formObj.observations,
          submitted_at: formObj.submitted_at,
        }
      : null,
  })
})

// Público: recibe las respuestas del visitante.
app.post('/public/property-visit-form/:slug/submit', async (c) => {
  const body = (await c.req.json()) as any
  const visitFormRepo = new D1PropertyVisitFormRepository(c.env.DB)
  const uc = new SubmitVisitFormUseCase(visitFormRepo)
  const priceRaw = body.subjective_price_usd
  const price =
    priceRaw === null || priceRaw === undefined || priceRaw === ''
      ? null
      : Number(priceRaw)
  const result = await uc.execute({
    slug: c.req.param('slug'),
    visitor_name: body.visitor_name ?? body.name ?? null,
    visitor_email: body.visitor_email ?? body.email ?? null,
    visitor_phone: body.visitor_phone ?? body.phone ?? null,
    liked: body.liked ?? null,
    disliked: body.disliked ?? null,
    subjective_price_usd: price,
    buy_intention: body.buy_intention ?? null,
    observations: body.observations ?? null,
  })
  // Hook marketing — necesitamos resolver org_id desde la ficha.
  const form = await visitFormRepo.findBySlug(c.req.param('slug'))
  if (form) {
    const mk = await fireMarketingEvent(c.env, {
      orgId: form.org_id,
      eventKey: 'visit_form_submitted',
      entityType: 'visit_form',
      entityId: form.id,
      userData: {
        full_name: body.visitor_name ?? body.name ?? null,
        email: body.visitor_email ?? body.email ?? null,
        phone: body.visitor_phone ?? body.phone ?? null,
        estimated_value: typeof price === 'number' ? price : null,
        client_ip_address: c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? null,
        client_user_agent: c.req.header('user-agent') ?? null,
      },
      customData: {
        buy_intention: body.buy_intention ?? null,
      },
      actionSource: 'website',
      eventSourceUrl: c.req.header('referer') ?? null,
      ga4ClientId: body.ga4_client_id ?? null,
    })
    return c.json({ ...result, marketing: mk ?? null }, 201)
  }
  return c.json(result, 201)
})

// ── PUBLIC PREFACTIBILIDAD (/p/:slug) ──────────────────────────
app.get('/public/prefact/:slug', async (c) => {
  const uc = new GetPublicPrefactibilidadUseCase(
    new D1PrefactibilidadRepository(c.env.DB),
  )
  const result = await uc.execute(c.req.param('slug'))
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

// ── PUBLIC LEADS (API-key gated) ─────────────────────────────────
app.post('/public/leads', async (c) => {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey) return c.json({ error: 'API key requerida' }, 401)

  const body = (await c.req.json()) as any

  const uc = new CreatePublicLeadUseCase(
    new D1OrganizationRepository(c.env.DB),
    new D1UserRepository(c.env.DB),
    new D1ContactRepository(c.env.DB),
    new D1LeadRepository(c.env.DB),
    new CryptoIdGenerator(),
  )

  const result = await uc.execute({
    apiKey,
    full_name: body.full_name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    source_detail: body.source_detail ?? null,
    operation: body.operation ?? 'otro',
    notes: body.notes ?? null,
  })

  return c.json(result, 201)
})

// ── PUBLIC LANDINGS ───────────────────────────────────────────
app.get('/l/:slug', async (c) => {
  const landings = new D1LandingRepository(c.env.DB)
  const versions = new D1LandingVersionRepository(c.env.DB)
  const uc = new GetPublicLandingUseCase(landings, versions)
  const view = await uc.execute({ fullSlug: c.req.param('slug') })
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
  return c.json({ landing: view })
})

app.post('/l/:slug/submit', async (c) => {
  const body = (await c.req.json()) as any
  const landings = new D1LandingRepository(c.env.DB)
  const events = new D1LandingEventRepository(c.env.DB)
  const leads = new D1LeadRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()

  const uc = new SubmitLeadFromLandingUseCase(landings, events, leads, idGen)
  const r = await uc.execute({
    fullSlug: c.req.param('slug'),
    fields: {
      name: String(body.name ?? ''),
      phone: String(body.phone ?? ''),
      email: body.email ?? null,
      address: body.address ?? null,
      message: body.message ?? null,
    },
    visitorId: body.visitorId ?? null,
    utm: body.utm ?? undefined,
  })
  c.header('Cache-Control', 'no-store')

  // Hook marketing — resolver org desde la landing pública.
  const landing = await landings.findByFullSlug(c.req.param('slug'))
  if (landing && (r as any).leadId) {
    const mk = await fireMarketingEvent(c.env, {
      orgId: landing.org_id,
      eventKey: 'landing_lead_submitted',
      entityType: 'lead',
      entityId: (r as any).leadId,
      leadId: (r as any).leadId,
      userData: {
        full_name: body.name ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        client_ip_address: c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? null,
        client_user_agent: c.req.header('user-agent') ?? null,
        external_id: body.visitorId ?? null,
      },
      customData: {
        landing_slug: c.req.param('slug'),
        utm_source: body.utm?.source ?? null,
        utm_medium: body.utm?.medium ?? null,
        utm_campaign: body.utm?.campaign ?? null,
      },
      actionSource: 'website',
      eventSourceUrl: c.req.header('referer') ?? null,
      ga4ClientId: body.visitorId ?? null,
    })
    return c.json({ ...r, marketing: mk ?? null }, 201)
  }
  return c.json(r, 201)
})

app.post('/l/:slug/event', async (c) => {
  const body = (await c.req.json()) as any
  const landings = new D1LandingRepository(c.env.DB)
  const events = new D1LandingEventRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()
  const uc = new RecordLandingEventUseCase(landings, events, idGen)
  await uc.execute({
    fullSlug: c.req.param('slug'),
    eventType: body.type,
    visitorId: body.visitorId ?? null,
    sessionId: body.sessionId ?? null,
    utmSource: body.utm?.source ?? null,
    utmMedium: body.utm?.medium ?? null,
    utmCampaign: body.utm?.campaign ?? null,
    referrer: body.utm?.referrer ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  })

  // Hook marketing — disparamos sólo en view (otros eventos ya se capturan).
  if (body.type === 'view') {
    const landing = await landings.findByFullSlug(c.req.param('slug'))
    if (landing) {
      await fireMarketingEvent(c.env, {
        orgId: landing.org_id,
        eventKey: 'landing_viewed',
        entityType: 'landing',
        entityId: landing.id,
        userData: {
          client_ip_address: c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? null,
          client_user_agent: c.req.header('user-agent') ?? null,
          external_id: body.visitorId ?? null,
        },
        customData: {
          landing_slug: c.req.param('slug'),
          utm_source: body.utm?.source ?? null,
          utm_medium: body.utm?.medium ?? null,
          utm_campaign: body.utm?.campaign ?? null,
        },
        actionSource: 'website',
        eventSourceUrl: c.req.header('referer') ?? null,
        ga4ClientId: body.visitorId ?? null,
      })
    }
  }
  return new Response(null, { status: 204 })
})

export default app
