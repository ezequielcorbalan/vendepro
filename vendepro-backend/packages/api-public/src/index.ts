import { Hono } from 'hono'
import { corsMiddleware, errorHandler, R2PdfStorage, PdfDownloadTokenSignerImpl, createIntegrationAuthMiddleware, JwtAuthService, D1ApiTokenRepository } from '@vendepro/infrastructure'
import {
  D1PropertyRepository,
  D1ReportRepository,
  D1AppraisalRepository,
  D1TemplateBlockRepository,
  D1VisitFormRepository,
  D1PropertyVisitFormRepository,
  D1FichaLinkRepository,
  D1FichaRepository,
  D1PrefactibilidadRepository,
  D1OrganizationRepository,
  D1UserRepository,
  D1ContactRepository,
  D1LeadRepository,
  D1LeadPropertyRepository,
  D1TagRepository,
  CryptoIdGenerator,
  D1LandingRepository,
  D1LandingVersionRepository,
  D1LandingEventRepository,
  D1OrgVariableRepository,
  D1EmailSuppressionRepository,
  D1PortalFeedRepository,
  HmacUnsubscribeTokenSigner,
  fireMarketingEvent,
  fireWebhookEvent,
  D1AgentProfileRepository,
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
  ImportLeadsUseCase,
  ProcessUnsubscribeUseCase,
  GetPublicFichaLinkUseCase,
  SubmitPublicFichaUseCase,
  propertyFromIncoming,
  buildLeadProperty,
  GetPortalFeedUseCase,
  GetPublicAgentLandingUseCase,
} from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; PUBLIC_BASE_URL?: string }
type IntegrationVars = { Variables: { orgId: string; tokenId: string; tokenScopes: string[] } }

const app = new Hono<{ Bindings: Env } & IntegrationVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

// ── API DE INTEGRACIÓN (/v1/*) — Bearer JWT de integración ─────
// Namespace autenticado dentro del worker público. El resto de /public y /l/*
// siguen sin auth. La validación es firma JWT + registro activo en api_tokens.
app.use('/v1/*', async (c, next) => {
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const apiTokenRepo = new D1ApiTokenRepository(c.env.DB)
  return createIntegrationAuthMiddleware(authService, apiTokenRepo)(c, next)
})

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
  // Si la ficha nació de un lead comprador, el submit marca su relación
  // lead_properties como 'visitada' con el feedback resumido.
  const uc = new SubmitVisitFormUseCase(visitFormRepo, new D1LeadPropertyRepository(c.env.DB))
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
      // Config por-agente: dispara bajo el pixel del agente dueño de la ficha.
      agentId: form.agent_id,
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

// ── FICHA DE TASACIÓN PÚBLICA (/f/:slug) ───────────────────────
// La completa el PROPIETARIO desde el celular, sin cuenta y sin entrar al CRM.
// Distinta de la ficha de visita (/v/), que la completa el comprador.
app.get('/public/ficha/:slug', async (c) => {
  const uc = new GetPublicFichaLinkUseCase(
    new D1FichaLinkRepository(c.env.DB),
    new D1OrganizationRepository(c.env.DB),
    new D1UserRepository(c.env.DB),
  )
  const result = await uc.execute(c.req.param('slug'))
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

// Cada envío crea contacto + lead + ficha + tasación en borrador.
app.post('/public/ficha/:slug/submit', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any

  // Honeypot: campo oculto que sólo completan los bots. Devolvemos éxito
  // para no darle señal al que scrapea, pero no escribimos nada.
  if (typeof body?.miel === 'string' && body.miel.trim() !== '') {
    return c.json({ success: true }, 201)
  }

  const linkRepo = new D1FichaLinkRepository(c.env.DB)
  const uc = new SubmitPublicFichaUseCase(
    linkRepo,
    new D1FichaRepository(c.env.DB),
    new D1LeadRepository(c.env.DB),
    new D1ContactRepository(c.env.DB),
    new D1UserRepository(c.env.DB),
    new D1AppraisalRepository(c.env.DB),
    new CryptoIdGenerator(),
  )
  const result = await uc.execute({
    slug: c.req.param('slug'),
    owner_name: body.owner_name ?? body.propietario_nombre ?? '',
    owner_phone: body.owner_phone ?? body.propietario_telefono ?? '',
    owner_email: body.owner_email ?? body.propietario_email ?? null,
    address: body.address ?? body.direccion ?? '',
    neighborhood: body.neighborhood ?? body.zona ?? null,
    property_type: body.property_type ?? null,
    floor_number: body.floor_number ?? body.piso ?? null,
    unit: body.unit ?? body.unidad ?? null,
    rooms: body.rooms ?? body.ambientes ?? null,
    bathrooms: body.bathrooms ?? body.banos ?? null,
    covered_area: body.covered_area ?? body.superficie_m2 ?? null,
    kitchen_type: body.kitchen_type ?? body.cocina ?? null,
    furnished: body.furnished ?? body.amueblado ?? null,
    age: body.age ?? body.antiguedad_anios ?? null,
    light_level: body.light_level ?? body.luminosidad ?? null,
    balcony_type: body.balcony_type ?? body.balcon ?? null,
    parking_type: body.parking_type ?? body.cochera ?? null,
    storage_rooms: body.storage_rooms ?? body.baulera ?? null,
    pets_allowed: body.pets_allowed ?? body.apto_mascota ?? null,
    is_professional: body.is_professional ?? body.apto_profesional ?? null,
    amenities: body.amenities ?? null,
    heating_type: body.heating_type ?? body.calefaccion ?? null,
    expenses: body.expenses ?? body.expensas ?? null,
    notes: body.notes ?? body.observaciones ?? null,
    // ── Superficies desglosadas y preguntas por tipo (042_) ──
    semi_area: body.semi_area ?? null,
    uncovered_area: body.uncovered_area ?? null,
    operation: body.operation ?? null,
    land_area: body.land_area ?? null,
    frontage_m: body.frontage_m ?? null,
    depth_m: body.depth_m ?? null,
    property_condition: body.property_condition ?? null,
    zoning: body.zoning ?? null,
    utilities: body.utilities ?? null,
    floors_count: body.floors_count ?? null,
    commercial_use: body.commercial_use ?? null,
    has_warehouse: body.has_warehouse ?? null,
    parking_unit: body.parking_unit ?? null,
    storage_unit: body.storage_unit ?? null,
  })

  // Mismo evento de conversión que el resto de las entradas web, para que la
  // captación por ficha se vea en el Meta/GA4 del agente dueño del link.
  const link = await linkRepo.findBySlug(c.req.param('slug'))
  const mk = await fireMarketingEvent(c.env, {
    orgId: result.org_id,
    agentId: link?.agent_id ?? null,
    eventKey: 'ficha_publica_submitted',
    entityType: 'lead',
    entityId: result.lead_id,
    leadId: result.lead_id,
    userData: {
      full_name: body.owner_name ?? null,
      email: body.owner_email ?? null,
      phone: body.owner_phone ?? null,
      client_ip_address: c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? null,
      client_user_agent: c.req.header('user-agent') ?? null,
      external_id: body.ga4_client_id ?? null,
    },
    customData: {
      source: 'ficha_web',
      ficha_link_mode: link?.mode ?? null,
    },
    actionSource: 'website',
    eventSourceUrl: c.req.header('referer') ?? null,
    ga4ClientId: body.ga4_client_id ?? null,
  })

  // Webhook saliente `lead.created`: las automatizaciones que ya escuchan
  // leads nuevos (n8n → Resend/OneTalk) no necesitan saber de este flujo.
  // Acá la dirección SÍ identifica una propiedad concreta (es una captación),
  // así que se arma el objeto `property` en vez de dejarlo en null.
  const assignedUser = await new D1UserRepository(c.env.DB)
    .findById(result.agent_id, result.org_id)
    .catch(() => null)
  await fireWebhookEvent(c.env, {
    orgId: result.org_id,
    event: 'lead.created',
    payload: {
      lead: {
        id: result.lead_id,
        full_name: body.owner_name ?? null,
        email: body.owner_email ?? null,
        phone: body.owner_phone ?? null,
        operation: body.operation ?? 'venta',
        source: 'ficha_web',
        source_detail: link?.label ?? 'Ficha de tasación web',
        notes: body.notes ?? null,
        contact_id: result.contact_id,
        assigned_agent: assignedUser
          ? { name: assignedUser.name ?? null, email: assignedUser.email ?? null }
          : null,
        property: buildLeadProperty({
          address: body.address ?? null,
          neighborhood: body.neighborhood ?? null,
          operation: body.operation ?? 'venta',
        }),
      },
    },
  })

  return c.json({ ...result, marketing: mk ?? null }, 201)
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

// ── INTEGRATION API: IMPORT LEADS (/v1/leads) — Bearer JWT ───────
// Acepta un lead único, un array, o { leads: [...] } (tope 100). Los leads
// entran sin asignar (stage `nuevo`). Requiere scope `leads:write`.
app.post('/v1/leads', async (c) => {
  const scopes = c.get('tokenScopes') ?? []
  if (!scopes.includes('leads:write')) {
    return c.json({ error: 'El token no tiene el scope leads:write' }, 403)
  }

  const body = (await c.req.json().catch(() => null)) as any
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Body JSON inválido' }, 400)
  }

  const rawLeads: any[] = Array.isArray(body)
    ? body
    : Array.isArray(body.leads)
      ? body.leads
      : [body]

  const orgId = c.get('orgId')
  const uc = new ImportLeadsUseCase(
    new D1LeadRepository(c.env.DB),
    new D1ContactRepository(c.env.DB),
    new D1UserRepository(c.env.DB),
    new CryptoIdGenerator(),
    new D1TagRepository(c.env.DB),
  )
  const result = await uc.execute({ orgId, leads: rawLeads })

  // Hook marketing por cada lead creado (mismo `lead_created` que /public/leads).
  // Los duplicados no crearon lead nuevo: no disparan eventos.
  await Promise.allSettled(
    result.results
      .filter((r) => r.ok && r.id && !r.duplicate)
      .map((r) => {
        const lead = rawLeads[r.index] ?? {}
        return fireMarketingEvent(c.env, {
          orgId,
          eventKey: 'lead_created',
          entityType: 'lead',
          entityId: r.id!,
          leadId: r.id!,
          userData: {
            full_name: lead.full_name ?? null,
            email: lead.email ?? null,
            phone: lead.phone ?? null,
            client_ip_address: c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? null,
            client_user_agent: c.req.header('user-agent') ?? null,
          },
          customData: {
            source: 'integration_api',
            source_detail: lead.source_detail ?? null,
          },
          actionSource: 'system_generated',
        })
      }),
  )

  // Webhook saliente `lead.created` por cada lead creado (n8n → Resend/OneTalk).
  // Los duplicados no crearon lead nuevo: no disparan `lead.created`.
  await Promise.allSettled(
    result.results
      .filter((r) => r.ok && r.id && !r.duplicate)
      .map((r) => {
        const lead = rawLeads[r.index] ?? {}
        return fireWebhookEvent(c.env, {
          orgId,
          event: 'lead.created',
          payload: {
            lead: {
              id: r.id!,
              full_name: lead.full_name ?? null,
              email: lead.email ?? null,
              phone: lead.phone ?? null,
              operation: lead.operation ?? null,
              source: 'integration_api',
              source_detail: lead.source_detail ?? null,
              notes: lead.notes ?? null,
              contact_id: (r as any).contact_id ?? null,
              // Los leads de la API de integración entran sin asignar.
              assigned_agent: null,
              property: propertyFromIncoming(lead),
              deduped: (r as any).deduped ?? false,
              tags: Array.isArray(lead.tags) ? lead.tags : [],
            },
          },
        })
      }),
  )

  // Un lote 100% duplicados también es éxito (el integrador no debe reintentar).
  return c.json(result, result.created > 0 || result.duplicates > 0 ? 201 : 400)
})

// ── PUBLIC LEADS (LEGACY, deprecado — usar POST /v1/leads con Bearer JWT) ──
// Securizado por header X-API-Key contra organizations.api_key. Se mantiene
// operativo para integraciones existentes.
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

  // Webhook saliente `lead.created` (misma semántica que /v1/leads).
  // El lead legacy se asigna al admin de la org (ver CreatePublicLeadUseCase).
  const legacyAdmin = await new D1UserRepository(c.env.DB).findFirstAdminByOrg(result.org_id).catch(() => null)
  const legacyAgent = legacyAdmin ? { name: legacyAdmin.name ?? null, email: legacyAdmin.email ?? null } : null
  await fireWebhookEvent(c.env, {
    orgId: result.org_id,
    event: 'lead.created',
    payload: {
      lead: {
        id: result.id,
        full_name: body.full_name ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        operation: body.operation ?? 'otro',
        source: 'public_api',
        source_detail: body.source_detail ?? null,
        notes: body.notes ?? null,
        assigned_agent: legacyAgent,
        property: propertyFromIncoming(body),
      },
    },
  })

  return c.json({ ...result, marketing: mk ?? null }, 201)
})

// ── LANDING PÚBLICA DE AGENTE ───────────────────────────────────
app.get('/a/:orgSlug/:agentSlug', async (c) => {
  const uc = new GetPublicAgentLandingUseCase(
    new D1OrganizationRepository(c.env.DB),
    new D1AgentProfileRepository(c.env.DB),
    new D1UserRepository(c.env.DB),
    new D1LandingRepository(c.env.DB),
  )
  const data = await uc.execute({
    orgSlug: c.req.param('orgSlug'),
    agentSlug: c.req.param('agentSlug'),
  })
  return c.json(data)
})

// ── PUBLIC LANDINGS ───────────────────────────────────────────
app.get('/l/:slug', async (c) => {
  const landings = new D1LandingRepository(c.env.DB)
  const versions = new D1LandingVersionRepository(c.env.DB)
  const orgs = new D1OrganizationRepository(c.env.DB)
  const agentProfiles = new D1AgentProfileRepository(c.env.DB)
  const uc = new GetPublicLandingUseCase(landings, versions, orgs, agentProfiles)
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
      // Config por-agente: dispara bajo el pixel del agente dueño de la landing.
      agentId: landing.agent_id,
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

  // Hook marketing — sólo en pageview (los otros eventos no necesitan CAPI).
  // En este caso devolvemos JSON con `marketing.event_id` para que el cliente
  // pueda pushearlo al dataLayer y dedupear con el Pixel.
  if (body.type === 'pageview') {
    const landing = await landings.findByFullSlug(c.req.param('slug'))
    if (landing) {
      const mk = await fireMarketingEvent(c.env, {
        orgId: landing.org_id,
        // Config por-agente: dispara bajo el pixel del agente dueño de la landing.
        agentId: landing.agent_id,
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

// ── EMAIL UNSUBSCRIBE (/u/:token en el frontend) ──────────────────
// GET: verifica el token y devuelve el email (para la página de
// confirmación). POST: ejecuta la baja. Idempotente en ambos casos.
app.get('/public/unsubscribe/:token', async (c) => {
  const signer = new HmacUnsubscribeTokenSigner(c.env.JWT_SECRET)
  const payload = await signer.verify(c.req.param('token'))
  if (!payload) return c.json({ ok: false }, 404)
  return c.json({ ok: true, email: payload.email })
})

app.post('/public/unsubscribe/:token', async (c) => {
  const uc = new ProcessUnsubscribeUseCase(
    new HmacUnsubscribeTokenSigner(c.env.JWT_SECRET),
    new D1EmailSuppressionRepository(c.env.DB),
    new CryptoIdGenerator(),
  )
  const result = await uc.execute(c.req.param('token'))
  if (!result.ok) return c.json(result, 404)
  return c.json(result)
})

// ── FEED XML DE PORTALES (/feed/:token.xml) ───────────────────────
// Lo crawlea ZonaProp/Argenprop desde el Panel del Anunciante. Sin auth:
// la protección es que el token de la URL no sea adivinable. Acepta el
// sufijo `.xml` porque algunos portales exigen que la URL termine así.
app.get('/feed/:token', async (c) => {
  const token = c.req.param('token').replace(/\.xml$/i, '')

  const uc = new GetPortalFeedUseCase(
    new D1PortalFeedRepository(c.env.DB),
    new D1OrganizationRepository(c.env.DB),
    c.env.PUBLIC_BASE_URL ?? 'https://www.marcelagenta.com',
  )
  const result = await uc.execute(token)
  if (!result) return c.text('Not found', 404)

  // Las propiedades descartadas se loguean (wrangler tail) en vez de ir al
  // XML: así el portal nunca recibe un aviso incompleto, pero queda rastro
  // de qué le falta a cada una.
  if (result.skipped.length > 0) {
    console.warn(
      `[feed:${result.portal}] ${result.skipped.length} propiedades omitidas`,
      JSON.stringify(result.skipped),
    )
  }

  return new Response(result.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // El portal crawlea cada varias horas; 10 min de cache absorbe
      // reintentos sin retrasar un cambio de precio de forma perceptible.
      'Cache-Control': 'public, max-age=600',
      'X-Feed-Items': String(result.included),
      'X-Feed-Skipped': String(result.skipped.length),
    },
  })
})

export default app
