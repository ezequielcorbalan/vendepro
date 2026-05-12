import { Hono } from 'hono'
import { corsMiddleware, errorHandler, R2PdfStorage, PdfDownloadTokenSignerImpl } from '@vendepro/infrastructure'
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
  D1OrgVariableRepository,
  fireMarketingEvent,
  fireNewLeadNotification,
  processBotMessage,
  D1WhatsappConfigRepository,
  D1BotConversationRepository,
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

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; EMBLUE_API_KEY?: string; GROQ_API_KEY?: string }

const app = new Hono<{ Bindings: Env }>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

// ── PUBLIC REPORT (/r/:slug) ───────────────────────────────────
app.get('/public/report/:slug', async (c) => {
  const uc = new GetPublicReportUseCase(
    new D1PropertyRepository(c.env.DB),
    new D1ReportRepository(c.env.DB),
    new D1OrganizationRepository(c.env.DB),
    new D1PropertyVisitFormRepository(c.env.DB),
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
    new D1OrgVariableRepository(c.env.DB),
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
          rating: formObj.rating,
          liked: formObj.liked,
          disliked: formObj.disliked,
          subjective_price_usd: formObj.subjective_price_usd,
          buy_intention: formObj.buy_intention,
          source: formObj.source,
          situation: formObj.situation,
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
  const ratingRaw = body.rating
  const rating =
    ratingRaw === null || ratingRaw === undefined || ratingRaw === ''
      ? null
      : Number(ratingRaw)
  const result = await uc.execute({
    slug: c.req.param('slug'),
    visitor_name: body.visitor_name ?? body.name ?? null,
    visitor_email: body.visitor_email ?? body.email ?? null,
    visitor_phone: body.visitor_phone ?? body.phone ?? null,
    rating,
    liked: body.liked ?? null,
    disliked: body.disliked ?? null,
    subjective_price_usd: price,
    buy_intention: body.buy_intention ?? null,
    source: body.source ?? null,
    situation: body.situation ?? null,
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

  // Hook marketing: evento `lead_created` tracked en el Meta/GA4 de la org
  // dueña de la API key. Esto permite que inmobiliarias externas que usan
  // VendéPro como CRM tengan conversion tracking en SUS cuentas.
  const mk = await fireMarketingEvent(c.env, {
    orgId: result.org_id,
    eventKey: 'lead_created',
    entityType: 'lead',
    entityId: result.id,
    leadId: result.id,
    userData: {
      full_name: body.full_name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      client_ip_address: c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? null,
      client_user_agent: c.req.header('user-agent') ?? null,
      external_id: body.visitorId ?? null,
    },
    customData: {
      source: 'public_api',
      source_detail: body.source_detail ?? null,
    },
    actionSource: 'website',
    eventSourceUrl: c.req.header('referer') ?? null,
    ga4ClientId: body.visitorId ?? null,
  })

  // Hook notificaciones: email al agente + WhatsApp al lead
  fireNewLeadNotification(c.env, {
    orgId: result.org_id,
    leadId: result.id,
    leadName: body.full_name ?? '',
    leadPhone: body.phone ?? null,
    leadEmail: body.email ?? null,
    leadSource: 'public_api',
    assignedToUserId: null,
  })

  return c.json({ ...result, marketing: mk ?? null }, 201)
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

    // Hook notificaciones: email al agente + WhatsApp al lead
    fireNewLeadNotification(c.env, {
      orgId: landing.org_id,
      leadId: (r as any).leadId,
      leadName: body.name ?? '',
      leadPhone: body.phone ?? null,
      leadEmail: body.email ?? null,
      leadSource: `landing:${c.req.param('slug')}`,
      assignedToUserId: null,
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

  // Hook marketing — sólo en pageview (los otros eventos no necesitan CAPI).
  // En este caso devolvemos JSON con `marketing.event_id` para que el cliente
  // pueda pushearlo al dataLayer y dedupear con el Pixel.
  if (body.type === 'pageview') {
    const landing = await landings.findByFullSlug(c.req.param('slug'))
    if (landing) {
      const mk = await fireMarketingEvent(c.env, {
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
      return c.json({ marketing: mk ?? null })
    }
  }
  return new Response(null, { status: 204 })
})

// ── PDF DOWNLOAD (JWT-gated) ──────────────────────────────────────
app.get('/public/pdf/:orgId/:appraisalId/:filename', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.text('Missing token', 401)

  const signer = new PdfDownloadTokenSignerImpl({ secret: c.env.JWT_SECRET, apiPublicBaseUrl: '' })
  const payload = await signer.verify(token)
  if (!payload) return c.text('Invalid or expired token', 401)

  if (payload.orgId !== c.req.param('orgId') || payload.appraisalId !== c.req.param('appraisalId')) {
    return c.text('Token mismatch', 403)
  }

  const storage = new R2PdfStorage(c.env.R2)
  const obj = await storage.get(payload.r2Key)
  if (!obj) return c.text('PDF not found', 404)

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.contentType,
      'Content-Disposition': obj.contentDisposition,
      'Content-Length': obj.size.toString(),
      'Cache-Control': 'private, max-age=900',
    },
  })
})

// ── CALLBELL WEBHOOK (incoming WhatsApp messages) ───────────────
app.post('/webhooks/callbell', async (c) => {
  const body = (await c.req.json()) as any

  // Callbell sends different event types — we only handle incoming messages
  if (body?.event !== 'message_created' || body?.payload?.direction !== 'in') {
    return c.json({ ok: true })
  }

  const phone = body?.payload?.sender?.phone ?? body?.payload?.contact?.phone
  const text = body?.payload?.text ?? body?.payload?.content?.text ?? ''
  if (!phone) return c.json({ error: 'no phone' }, 400)

  // Resolve org from webhook secret header
  const secret = c.req.header('X-Webhook-Secret')
  if (!secret) return c.json({ error: 'missing secret' }, 401)

  const configRepo = new D1WhatsappConfigRepository(c.env.DB)
  // Find org by webhook_secret — iterate is fine since few orgs
  const allOrgs = await c.env.DB
    .prepare('SELECT org_id FROM whatsapp_config WHERE webhook_secret = ?')
    .bind(secret)
    .first() as any
  if (!allOrgs) return c.json({ error: 'invalid secret' }, 401)

  const result = await processBotMessage(c.env as any, {
    orgId: allOrgs.org_id,
    phone,
    text,
  })

  return c.json(result)
})

// ── CHAT WIDGET (public, slug-based) ────────────────────────────

// GET config for the widget (branding + welcome message)
app.get('/widget/:slug/config', async (c) => {
  const orgRepo = new D1OrganizationRepository(c.env.DB)
  const org = await orgRepo.findBySlug(c.req.param('slug'))
  if (!org) return c.json({ error: 'not found' }, 404)

  const waConfigRepo = new D1WhatsappConfigRepository(c.env.DB)
  const config = await waConfigRepo.findByOrgId(org.id)

  c.header('Cache-Control', 'public, max-age=300')
  return c.json({
    org_name: org.name,
    logo_url: org.logo_url,
    brand_color: org.brand_color || '#ff007c',
    brand_accent_color: org.brand_accent_color || '#ff8017',
    welcome_message: config?.welcome_template?.replace(/\{\{name\}\}/g, '') ??
      '¡Hola! ¿En qué te puedo ayudar?',
    bot_enabled: config?.bot_enabled ?? false,
  })
})

// POST message from widget → bot processes and returns reply
app.post('/widget/:slug/chat', async (c) => {
  const orgRepo = new D1OrganizationRepository(c.env.DB)
  const org = await orgRepo.findBySlug(c.req.param('slug'))
  if (!org) return c.json({ error: 'not found' }, 404)

  const body = (await c.req.json()) as any
  const sessionId = body.session_id
  const text = body.text ?? ''
  const visitorData = body.visitor ?? {}

  if (!sessionId) return c.json({ error: 'session_id requerido' }, 400)

  const botRepo = new D1BotConversationRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()
  const now = new Date().toISOString()

  // Find or create conversation for this session
  let conversation = await botRepo.findActiveByPhone(sessionId, org.id)

  if (!conversation) {
    // First message — create lead + conversation
    const leadRepo = new D1LeadRepository(c.env.DB)
    const userRepo = new D1UserRepository(c.env.DB)
    const admin = await userRepo.findFirstAdminByOrg(org.id)

    const leadId = idGen.generate()
    const contactRepo = new D1ContactRepository(c.env.DB)
    const createLead = new (await import('@vendepro/core')).CreateLeadWithContactUseCase(
      leadRepo, contactRepo, idGen,
    )
    const leadResult = await createLead.execute({
      org_id: org.id,
      assigned_to: admin?.id ?? '',
      full_name: visitorData.name || 'Visitante web',
      phone: visitorData.phone || null,
      email: visitorData.email || null,
      source: 'widget',
      source_detail: `widget:${c.req.param('slug')}`,
      operation: 'otro',
      notes: null,
    })

    conversation = {
      id: idGen.generate(),
      org_id: org.id,
      lead_id: leadResult.id,
      phone: sessionId,
      current_step: 'welcome',
      answers: {},
      status: 'active',
      created_at: now,
      updated_at: now,
    }
    await botRepo.save(conversation)

    // Fire notification to agent
    fireNewLeadNotification(c.env, {
      orgId: org.id,
      leadId: leadResult.id,
      leadName: visitorData.name || 'Visitante web',
      leadPhone: visitorData.phone || null,
      leadEmail: visitorData.email || null,
      leadSource: 'widget',
      assignedToUserId: admin?.id ?? null,
    })

    // Return welcome question
    const waConfigRepo2 = new D1WhatsappConfigRepository(c.env.DB)
    const config = await waConfigRepo2.findByOrgId(org.id)
    const welcome = config?.welcome_template?.replace(/\{\{name\}\}/g, visitorData.name || '') ??
      '¡Hola! ¿Estás buscando comprar/alquilar o querés vender/tasar una propiedad?'

    return c.json({ reply: welcome, step: 'welcome', lead_id: leadResult.id })
  }

  // Existing conversation — process the message through bot logic
  const result = await processBotMessage(c.env as any, {
    orgId: org.id,
    phone: sessionId,
    text,
  })

  // Build reply based on step
  const BOT_REPLIES: Record<string, string> = {
    zone: '¿En qué zona o barrio te interesa?',
    budget: '¿Tenés un presupuesto estimado en USD?',
    done: '¡Perfecto! Ya le paso tus datos a un agente que te va a contactar en breve. ¡Gracias!',
  }

  const updatedConv = await botRepo.findActiveByPhone(sessionId, org.id)
  const currentStep = updatedConv?.current_step ?? result.step ?? 'done'
  const reply = BOT_REPLIES[currentStep] ?? '¡Gracias por tu mensaje! Un agente te va a contactar pronto.'

  return c.json({ reply, step: currentStep, done: currentStep === 'done' })
})

export default app
