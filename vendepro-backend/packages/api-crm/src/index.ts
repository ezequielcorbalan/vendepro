import { Hono } from 'hono'
import {
  corsMiddleware, errorHandler, createAuthMiddleware,
  D1LeadRepository, D1ContactRepository, D1CalendarRepository, D1ActivityRepository, D1UserRepository,
  D1TagRepository, D1StageHistoryRepository, D1OrganizationRepository,
  D1MetaIntegrationRepository, D1StageEventMappingRepository, D1MetaEventLogRepository,
  D1PropertyRepository, D1ApiTokenRepository,
  D1WebhookRepository, D1WebhookDeliveryRepository, HttpWebhookSender,
  D1OrgIntegrationRepository, D1IntegrationLinkRepository, D1IntegrationSyncLogRepository,
  KitepropMcpClient,
  D1UserIntegrationRepository, GoogleCalendarHttpClient, buildGoogleAuthUrl,
  D1EmailSettingsRepository, D1EmailSuppressionRepository, ResendEmailService,
  JwtAuthService, CryptoIdGenerator,
  encrypt, decrypt,
  createMarketingSender, fireMarketingEvent, fireWebhookEvent,
} from '@vendepro/infrastructure'
import { Activity } from '@vendepro/core'
import {
  GetLeadsUseCase, UpdateLeadUseCase, DeleteLeadUseCase, AdvanceLeadStageUseCase,
  GetContactsUseCase, CreateContactUseCase, UpdateContactUseCase, DeleteContactUseCase,
  GetCalendarEventsUseCase, CreateCalendarEventUseCase, ToggleEventCompleteUseCase, RescheduleEventUseCase,
  CreateLeadWithContactUseCase, GetContactDetailUseCase, CreateTagUseCase,
  GenerateOrgApiKeyUseCase, GetOrgApiKeyUseCase,
  GetMetaIntegrationUseCase, SaveMetaIntegrationUseCase,
  ListStageMappingsUseCase, SaveStageMappingUseCase, DeleteStageMappingUseCase,
  ListMetaEventLogUseCase,
  CreateApiTokenUseCase, ListApiTokensUseCase, RevokeApiTokenUseCase, DeleteApiTokenUseCase,
  CreateWebhookUseCase, ListWebhooksUseCase, UpdateWebhookUseCase, DeleteWebhookUseCase,
  TestWebhookUseCase, ListWebhookDeliveriesUseCase,
  SaveOrgIntegrationUseCase, GetOrgIntegrationUseCase,
  TestKitepropConnectionUseCase, SyncKitepropContactsUseCase,
  GetKitepropAgentsUseCase, SaveAgentMapUseCase,
  GetGoogleIntegrationUseCase, ConnectGoogleCalendarUseCase,
  DisconnectGoogleCalendarUseCase, SaveGoogleIntegrationSettingsUseCase,
  SyncEventToGoogleUseCase,
  GetEmailSettingsUseCase, SaveEmailSettingsUseCase,
  SendTestEmailUseCase, ListEmailSuppressionsUseCase,
} from '@vendepro/core'
import {
  CreateLandingFromTemplateUseCase, UpdateLandingBlocksUseCase, AddBlockUseCase,
  RemoveBlockUseCase, ReorderBlocksUseCase, ToggleBlockVisibilityUseCase,
  RequestPublishUseCase, PublishLandingUseCase, RejectPublishRequestUseCase,
  ArchiveLandingUseCase, UnarchiveLandingUseCase, RollbackLandingUseCase,
  ListTemplatesUseCase, CreateTemplateUseCase, UpdateTemplateUseCase,
  ListLandingsUseCase, GetLandingUseCase, UpdateLandingMetadataUseCase,
  GetLandingAnalyticsUseCase,
} from '@vendepro/core'
import {
  D1LandingRepository, D1LandingTemplateRepository,
  D1LandingVersionRepository, D1LandingEventRepository,
} from '@vendepro/infrastructure'

type Env = {
  DB: D1Database
  JWT_SECRET: string
  // Google Calendar OAuth (secrets vía wrangler secret put / dashboard)
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  // Fallback del redirect al frontend post-OAuth (normalmente sale del header Origin)
  FRONTEND_URL?: string
  // Email marketing (Resend) — secret vía wrangler secret put / dashboard
  RESEND_API_KEY?: string
}
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

const GOOGLE_CALLBACK_PATH = '/integrations/google/callback'

// Apply auth to all routes
app.use('*', async (c, next) => {
  // El callback OAuth llega por redirect del navegador (sin Bearer): se
  // autentica con el JWT firmado que viaja en `state`.
  if (c.req.path === GOOGLE_CALLBACK_PATH) return next()
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  return createAuthMiddleware(authService)(c, next)
})

// ── LEADS ──────────────────────────────────────────────────────
app.get('/leads', async (c) => {
  const { id, stage, agent_id, search } = c.req.query()
  const repo = new D1LeadRepository(c.env.DB)
  // Detalle de un lead puntual: ?id=X devuelve el lead solo, no toda la lista.
  if (id) {
    const lead = await repo.findById(id, c.get('orgId'))
    if (!lead) return c.json({ error: 'Lead no encontrado' }, 404)
    return c.json(lead.toObject?.() ?? lead)
  }
  const useCase = new GetLeadsUseCase(repo)
  const leads = await useCase.execute(c.get('orgId'), { stage, agent_id, search })
  return c.json(leads.map(l => l.toObject?.() ?? l))
})

app.post('/leads', async (c) => {
  const body = (await c.req.json()) as any
  const leadRepo = new D1LeadRepository(c.env.DB)
  const contactRepo = new D1ContactRepository(c.env.DB)
  const useCase = new CreateLeadWithContactUseCase(leadRepo, contactRepo, new CryptoIdGenerator())
  const result = await useCase.execute({
    ...body,
    org_id: c.get('orgId'),
    assigned_to: body.assigned_to || c.get('userId'),
  })
  // Hook marketing: evento `lead_created` (Meta + GA4 si están mapeados).
  const mk = await fireMarketingEvent(c.env, {
    orgId: c.get('orgId'),
    eventKey: 'lead_created',
    entityType: 'lead',
    entityId: result.id,
    leadId: result.id,
    userData: {
      full_name: body.full_name ?? body.contact_data?.full_name ?? null,
      email: body.email ?? body.contact_data?.email ?? null,
      phone: body.phone ?? body.contact_data?.phone ?? null,
      estimated_value: typeof body.estimated_value === 'number' ? body.estimated_value : null,
    },
    actionSource: 'system_generated',
  })
  // Webhook saliente `lead.created` (n8n → Resend/OneTalk).
  await fireWebhookEvent(c.env, {
    orgId: c.get('orgId'),
    event: 'lead.created',
    payload: {
      lead: {
        id: result.id,
        full_name: body.full_name ?? body.contact_data?.full_name ?? null,
        email: body.email ?? body.contact_data?.email ?? null,
        phone: body.phone ?? body.contact_data?.phone ?? null,
        operation: body.operation ?? null,
        source: 'manual',
        source_detail: body.source_detail ?? null,
        notes: body.notes ?? null,
        contact_id: result.contact_id ?? null,
        tags: Array.isArray(body.tags) ? body.tags : [],
      },
    },
  })
  return c.json({ ...result, marketing: mk ?? null }, 201)
})

app.put('/leads', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1LeadRepository(c.env.DB)
  const useCase = new UpdateLeadUseCase(repo)
  await useCase.execute({ ...body, orgId: c.get('orgId') })
  return c.json({ success: true })
})

app.delete('/leads', async (c) => {
  const { id } = c.req.query()
  const repo = new D1LeadRepository(c.env.DB)
  const useCase = new DeleteLeadUseCase(repo)
  await useCase.execute(id, c.get('orgId'))
  return c.json({ success: true })
})

app.post('/leads/stage', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1LeadRepository(c.env.DB)
  const calRepo = new D1CalendarRepository(c.env.DB)
  const historyRepo = new D1StageHistoryRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()
  // metaSender interno desactivado: el hook multi-provider de abajo cubre
  // Meta + GA4 y además expone event_id al frontend (dedup Pixel+CAPI).
  const propRepo = new D1PropertyRepository(c.env.DB)
  const useCase = new AdvanceLeadStageUseCase(repo, calRepo, historyRepo, idGen, propRepo)
  const result = await useCase.execute({ leadId: body.id, orgId: c.get('orgId'), newStage: body.stage, changedBy: c.get('userId'), notes: body.notes, override: body.override === true })

  const mk = await fireMarketingEvent(c.env, {
    orgId: c.get('orgId'),
    eventKey: body.stage,
    entityType: 'lead',
    entityId: body.id,
    leadId: body.id,
    actionSource: 'system_generated',
    ga4ClientId: body.ga4_client_id ?? null,
  })
  // Webhook saliente `lead.stage_changed`.
  await fireWebhookEvent(c.env, {
    orgId: c.get('orgId'),
    event: 'lead.stage_changed',
    payload: {
      lead_id: body.id,
      from_stage: result.fromStage,
      to_stage: body.stage,
      changed_by: c.get('userId'),
      notes: body.notes ?? null,
    },
  })
  return c.json({ ...result, marketing: mk ?? null })
})

// ── MARKETING (Meta CAPI + GA4 MP + Stape sGTM) ────────────────

function requireAdmin(c: any) {
  const role = c.get('userRole') as string
  if (role !== 'admin' && role !== 'owner') {
    return c.json({ error: 'Sin permisos (sólo admin/owner)' }, 403)
  }
  return null
}

app.get('/marketing/integration', async (c) => {
  const repo = new D1MetaIntegrationRepository(c.env.DB)
  const useCase = new GetMetaIntegrationUseCase(repo)
  const result = await useCase.execute(c.get('orgId'))
  return c.json(result)
})

app.put('/marketing/integration', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json()) as any
  const repo = new D1MetaIntegrationRepository(c.env.DB)
  const useCase = new SaveMetaIntegrationUseCase(repo, (plain) => encrypt(plain, c.env.JWT_SECRET))
  // PATCH semántico: campo ausente (undefined) preserva el valor guardado;
  // null o '' lo limpian. No coercionar ausentes a null — borraría campos
  // en updates parciales.
  await useCase.execute({
    orgId: c.get('orgId'),
    pixel_id: body.pixel_id,
    access_token: body.access_token,
    stape_endpoint: body.stape_endpoint,
    gtm_container_id: body.gtm_container_id,
    test_event_code: body.test_event_code,
    ad_account_id: body.ad_account_id,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    ga4_measurement_id: body.ga4_measurement_id,
    ga4_api_secret: body.ga4_api_secret,
    ga4_enabled: typeof body.ga4_enabled === 'boolean' ? body.ga4_enabled : undefined,
  })
  return c.json({ success: true })
})

app.get('/marketing/mappings', async (c) => {
  const repo = new D1StageEventMappingRepository(c.env.DB)
  const useCase = new ListStageMappingsUseCase(repo)
  const list = await useCase.execute(c.get('orgId'))
  return c.json(list.map(m => m.toObject()))
})

app.post('/marketing/mappings', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json()) as any
  const repo = new D1StageEventMappingRepository(c.env.DB)
  const useCase = new SaveStageMappingUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({
    orgId: c.get('orgId'),
    stage_key: body.stage_key,
    meta_event_name: body.meta_event_name,
    ga4_event_name: body.ga4_event_name ?? undefined,
    enabled: body.enabled,
  })
  return c.json(result, 201)
})

app.delete('/marketing/mappings/:id', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const repo = new D1StageEventMappingRepository(c.env.DB)
  const useCase = new DeleteStageMappingUseCase(repo)
  await useCase.execute(c.req.param('id'), c.get('orgId'))
  return c.json({ success: true })
})

app.post('/marketing/test-event', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json().catch(() => ({}))) as any
  const stageKey = body.stage_key as string
  if (!stageKey) return c.json({ error: 'stage_key es requerido' }, 400)
  const sender = createMarketingSender(c.env)
  const result = await sender.execute({
    orgId: c.get('orgId'),
    eventKey: stageKey,
    entityType: 'lead',
    entityId: `test-${Date.now()}`,
    leadId: `test-${Date.now()}`,
    userData: {
      full_name: 'Test Lead',
      email: 'test@vendepro.test',
      phone: '+5491100000000',
      estimated_value: 100000,
    },
    actionSource: 'system_generated',
    testEventCodeOverride: body.test_event_code ?? null,
    ga4ClientId: `test.${Date.now()}`,
  })
  return c.json(result)
})

app.get('/marketing/event-log', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50', 10)
  const repo = new D1MetaEventLogRepository(c.env.DB)
  const useCase = new ListMetaEventLogUseCase(repo)
  const list = await useCase.execute(c.get('orgId'), Number.isFinite(limit) ? limit : 50)
  return c.json(list.map(l => l.toObject()))
})

// ── MARKETING — EMAIL (Resend) ─────────────────────────────────

app.get('/marketing/email/settings', async (c) => {
  const useCase = new GetEmailSettingsUseCase(new D1EmailSettingsRepository(c.env.DB))
  const result = await useCase.execute(c.get('orgId'))
  return c.json(result)
})

app.put('/marketing/email/settings', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json()) as any
  const useCase = new SaveEmailSettingsUseCase(new D1EmailSettingsRepository(c.env.DB))
  // PATCH semántico (mismo criterio que /marketing/integration):
  // ausente preserva, null/'' limpia.
  await useCase.execute({
    orgId: c.get('orgId'),
    from_name: body.from_name,
    from_email: body.from_email,
    reply_to: body.reply_to,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
  })
  return c.json({ success: true })
})

app.post('/marketing/email/test', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  if (!c.env.RESEND_API_KEY) {
    return c.json({ error: 'Envío de emails no disponible: falta configurar RESEND_API_KEY en el worker' }, 503)
  }
  const body = (await c.req.json().catch(() => ({}))) as any
  const useCase = new SendTestEmailUseCase(
    new D1EmailSettingsRepository(c.env.DB),
    new ResendEmailService(c.env.RESEND_API_KEY),
  )
  const result = await useCase.execute({ orgId: c.get('orgId'), to: body.to })
  return c.json(result, result.ok ? 200 : 502)
})

app.get('/marketing/email/suppressions', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const limit = parseInt(c.req.query('limit') ?? '100', 10)
  const useCase = new ListEmailSuppressionsUseCase(new D1EmailSuppressionRepository(c.env.DB))
  const list = await useCase.execute(c.get('orgId'), Number.isFinite(limit) ? limit : 100)
  return c.json(list.map(s => s.toObject()))
})

// ── INTEGRACIONES CRM (KiteProp) ───────────────────────────────
// Config sensible: TODAS las rutas (incluido el GET) son sólo admin.

function buildKitepropSync(env: Env) {
  return new SyncKitepropContactsUseCase(
    new D1OrgIntegrationRepository(env.DB),
    new D1IntegrationLinkRepository(env.DB),
    new D1IntegrationSyncLogRepository(env.DB),
    new D1ContactRepository(env.DB),
    new D1UserRepository(env.DB),
    new KitepropMcpClient(),
    new CryptoIdGenerator(),
    (cipher) => decrypt(cipher, env.JWT_SECRET),
  )
}

app.get('/integrations/kiteprop', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const useCase = new GetOrgIntegrationUseCase(new D1OrgIntegrationRepository(c.env.DB))
  const result = await useCase.execute({ orgId: c.get('orgId'), provider: 'kiteprop' })
  return c.json(result)
})

app.put('/integrations/kiteprop', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json()) as any
  const useCase = new SaveOrgIntegrationUseCase(
    new D1OrgIntegrationRepository(c.env.DB),
    new CryptoIdGenerator(),
    (plain) => encrypt(plain, c.env.JWT_SECRET),
  )
  // PATCH semántico: undefined preserva; '' limpia; '********' no pisa.
  const result = await useCase.execute({
    orgId: c.get('orgId'),
    provider: 'kiteprop',
    name: body.name,
    api_key: body.api_key,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
  })
  return c.json(result)
})

app.post('/integrations/kiteprop/test', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json().catch(() => ({}))) as any
  const useCase = new TestKitepropConnectionUseCase(
    new D1OrgIntegrationRepository(c.env.DB),
    new KitepropMcpClient(),
    (cipher) => decrypt(cipher, c.env.JWT_SECRET),
  )
  const result = await useCase.execute({
    orgId: c.get('orgId'),
    api_key: typeof body.api_key === 'string' ? body.api_key : undefined,
  })
  return c.json(result)
})

app.post('/integrations/kiteprop/sync', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const result = await buildKitepropSync(c.env).execute({ orgId: c.get('orgId'), mode: 'manual' })
  return c.json(result, result.ok ? 200 : 400)
})

app.post('/integrations/kiteprop/backfill', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  // Chunked: la UI repite el POST hasta done:true (límite de subrequests).
  const result = await buildKitepropSync(c.env).execute({ orgId: c.get('orgId'), mode: 'backfill' })
  return c.json(result, result.ok ? 200 : 400)
})

// Re-procesa el histórico de consultas (message-driven, sin corte por fecha):
// re-atribuye el agente mapeado y trae la propiedad a los contactos ya importados.
app.post('/integrations/kiteprop/enrich', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const result = await buildKitepropSync(c.env).execute({ orgId: c.get('orgId'), mode: 'enrich' })
  return c.json(result, result.ok ? 200 : 400)
})

// Agentes de KiteProp + el mapeo guardado (para la UI de mapeo).
app.get('/integrations/kiteprop/agents', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const useCase = new GetKitepropAgentsUseCase(
    new D1OrgIntegrationRepository(c.env.DB),
    new KitepropMcpClient(),
    (cipher) => decrypt(cipher, c.env.JWT_SECRET),
  )
  const result = await useCase.execute(c.get('orgId'))
  return c.json(result)
})

// Guarda el mapeo agente KiteProp → usuario VendéPro.
app.put('/integrations/kiteprop/agent-map', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json().catch(() => ({}))) as any
  const map = (body.map && typeof body.map === 'object') ? body.map as Record<string, string> : {}
  const useCase = new SaveAgentMapUseCase(new D1OrgIntegrationRepository(c.env.DB))
  const result = await useCase.execute({ orgId: c.get('orgId'), map })
  return c.json(result, result.ok ? 200 : 400)
})

app.get('/integrations/kiteprop/log', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const repo = new D1IntegrationSyncLogRepository(c.env.DB)
  const list = await repo.listByOrg(c.get('orgId'), 20)
  return c.json(list)
})

// ── INTEGRACIÓN GOOGLE CALENDAR (por usuario, no admin-only) ───
// Cada agente conecta SU cuenta: los eventos del CRM se espejan en su
// calendar y el cliente recibe la invitación de Google por email.

function googleConfigured(env: Env): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

function googleGateway(env: Env) {
  return new GoogleCalendarHttpClient(env.GOOGLE_CLIENT_ID ?? '', env.GOOGLE_CLIENT_SECRET ?? '')
}

function googleRedirectUri(c: any): string {
  return new URL(c.req.url).origin + GOOGLE_CALLBACK_PATH
}

function buildGoogleSync(env: Env) {
  return new SyncEventToGoogleUseCase(
    new D1UserIntegrationRepository(env.DB),
    new D1CalendarRepository(env.DB),
    new D1ContactRepository(env.DB),
    googleGateway(env),
    (plain) => encrypt(plain, env.JWT_SECRET),
    (cipher) => decrypt(cipher, env.JWT_SECRET),
  )
}

/**
 * Espejo best-effort de un evento local en el Google Calendar del agente.
 * Nunca tira: la operación local ya se completó y no debe revertirse.
 */
async function mirrorEventToGoogle(
  env: Env,
  input: { orgId: string; agentId: string; action: 'upsert' | 'delete'; eventId?: string; googleEventId?: string | null; attendeeEmail?: string | null },
): Promise<{ synced: boolean; inviteSent: boolean; reason?: string } | null> {
  if (!googleConfigured(env)) return null
  try {
    return await buildGoogleSync(env).execute(input)
  } catch (err: any) {
    return { synced: false, inviteSent: false, reason: err?.message || 'sync_failed' }
  }
}

app.get('/integrations/google', async (c) => {
  try {
    const useCase = new GetGoogleIntegrationUseCase(new D1UserIntegrationRepository(c.env.DB))
    const view = await useCase.execute({ userId: c.get('userId') })
    return c.json({ configured: googleConfigured(c.env), ...view })
  } catch {
    // tabla user_integrations ausente (migración 035 sin aplicar)
    return c.json({ configured: googleConfigured(c.env), connected: false, enabled: false, auto_invite: true, email: null, last_sync_at: null })
  }
})

app.put('/integrations/google', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any
  const useCase = new SaveGoogleIntegrationSettingsUseCase(new D1UserIntegrationRepository(c.env.DB))
  const view = await useCase.execute({
    userId: c.get('userId'),
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    auto_invite: typeof body.auto_invite === 'boolean' ? body.auto_invite : undefined,
  })
  return c.json({ configured: googleConfigured(c.env), ...view })
})

app.get('/integrations/google/auth-url', async (c) => {
  if (!googleConfigured(c.env)) {
    return c.json({ error: 'Google Calendar no está configurado en el servidor (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)' }, 501)
  }
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const state = await authService.createToken({
    purpose: 'google_calendar_oauth',
    sub: c.get('userId'),
    org_id: c.get('orgId'),
    return_to: c.req.header('Origin') || c.env.FRONTEND_URL || '',
  }, { expiresIn: '10m' })
  return c.json({
    url: buildGoogleAuthUrl({ clientId: c.env.GOOGLE_CLIENT_ID as string, redirectUri: googleRedirectUri(c), state }),
  })
})

// Redirect de Google (sin Bearer: el middleware lo deja pasar y acá se
// valida el JWT de `state`, que lleva userId/orgId y expira a los 10 min).
app.get(GOOGLE_CALLBACK_PATH, async (c) => {
  const { code, state, error } = c.req.query()
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const payload = state ? await authService.verifyToken(state) : null

  const returnTo = typeof payload?.return_to === 'string' && payload.return_to ? payload.return_to : (c.env.FRONTEND_URL || '')
  const finish = (status: 'ok' | 'error', reason?: string) => {
    if (!returnTo) return c.json({ google: status, reason: reason ?? null }, status === 'ok' ? 200 : 400)
    const url = new URL('/configuracion/conexiones', returnTo)
    url.searchParams.set('google', status)
    if (reason) url.searchParams.set('reason', reason)
    return c.redirect(url.toString(), 302)
  }

  if (!payload || payload.purpose !== 'google_calendar_oauth' || typeof payload.sub !== 'string') {
    return finish('error', 'state_invalido')
  }
  if (error) return finish('error', String(error))
  if (!code) return finish('error', 'sin_code')
  if (!googleConfigured(c.env)) return finish('error', 'no_configurado')

  try {
    const useCase = new ConnectGoogleCalendarUseCase(
      new D1UserIntegrationRepository(c.env.DB),
      googleGateway(c.env),
      new CryptoIdGenerator(),
      (plain) => encrypt(plain, c.env.JWT_SECRET),
    )
    await useCase.execute({
      orgId: String(payload.org_id ?? ''),
      userId: payload.sub,
      code,
      redirectUri: googleRedirectUri(c),
    })
    return finish('ok')
  } catch {
    return finish('error', 'canje_fallido')
  }
})

app.delete('/integrations/google', async (c) => {
  const useCase = new DisconnectGoogleCalendarUseCase(
    new D1UserIntegrationRepository(c.env.DB),
    googleGateway(c.env),
    (cipher) => decrypt(cipher, c.env.JWT_SECRET),
  )
  const result = await useCase.execute({ userId: c.get('userId') })
  return c.json(result)
})

// ── CONTACTS ───────────────────────────────────────────────────
app.get('/contacts', async (c) => {
  const { search, agent_id, tag_id } = c.req.query()
  const repo = new D1ContactRepository(c.env.DB)
  const tagRepo = new D1TagRepository(c.env.DB)
  const useCase = new GetContactsUseCase(repo, tagRepo)
  const contacts = await useCase.execute(c.get('orgId'), { search, agent_id, tag_id })
  return c.json(contacts)
})

app.get('/contacts/:id', async (c) => {
  const id = c.req.param('id')
  const repo = new D1ContactRepository(c.env.DB)
  const useCase = new GetContactDetailUseCase(repo)
  const detail = await useCase.execute(id, c.get('orgId'))
  if (!detail) return c.json({ error: 'Contacto no encontrado' }, 404)
  return c.json({
    ...detail.contact.toObject(),
    agent_name: detail.agent_name,
    leads: detail.leads,
    properties: detail.properties,
  })
})

app.post('/contacts', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ContactRepository(c.env.DB)
  const useCase = new CreateContactUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ ...body, org_id: c.get('orgId'), agent_id: body.agent_id || c.get('userId') })
  return c.json(result, 201)
})

app.put('/contacts', async (c) => {
  const body = (await c.req.json()) as any
  const { id } = c.req.query()
  if (!id) return c.json({ error: 'id es requerido' }, 400)
  const repo = new D1ContactRepository(c.env.DB)
  const useCase = new UpdateContactUseCase(repo)
  await useCase.execute(id, c.get('orgId'), {
    full_name: body.full_name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    contact_type: body.contact_type,
    neighborhood: body.neighborhood ?? null,
    notes: body.notes ?? null,
  })
  return c.json({ success: true })
})

app.delete('/contacts', async (c) => {
  const { id } = c.req.query()
  const repo = new D1ContactRepository(c.env.DB)
  const useCase = new DeleteContactUseCase(repo)
  await useCase.execute(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── CALENDAR ───────────────────────────────────────────────────
app.get('/calendar', async (c) => {
  const { agent_id, start, end, event_type } = c.req.query()
  const repo = new D1CalendarRepository(c.env.DB)
  const useCase = new GetCalendarEventsUseCase(repo)
  const events = await useCase.execute(c.get('orgId'), { agent_id, start, end, event_type })
  return c.json(events.map(e => e.toObject()))
})

app.post('/calendar', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1CalendarRepository(c.env.DB)
  const useCase = new CreateCalendarEventUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ ...body, org_id: c.get('orgId'), agent_id: body.agent_id || c.get('userId') })
  // Espejo en el Google Calendar del agente (si lo conectó). Best-effort.
  const google = await mirrorEventToGoogle(c.env, {
    orgId: c.get('orgId'),
    agentId: body.agent_id || c.get('userId'),
    eventId: result.id,
    action: 'upsert',
    attendeeEmail: typeof body.client_email === 'string' ? body.client_email : null,
  })
  return c.json({ ...result, google }, 201)
})

app.put('/calendar/complete', async (c) => {
  const { id } = c.req.query()
  const repo = new D1CalendarRepository(c.env.DB)
  const useCase = new ToggleEventCompleteUseCase(repo)
  const result = await useCase.execute(id, c.get('orgId'))
  return c.json(result)
})

app.put('/calendar/reschedule', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1CalendarRepository(c.env.DB)
  const useCase = new RescheduleEventUseCase(repo)
  await useCase.execute({ eventId: body.id, orgId: c.get('orgId'), startAt: body.start_at, endAt: body.end_at })
  // Si el evento estaba espejado en Google, actualiza el horario allá también.
  try {
    const event = await repo.findById(body.id, c.get('orgId'))
    if (event?.google_event_id) {
      await mirrorEventToGoogle(c.env, {
        orgId: c.get('orgId'), agentId: event.agent_id, eventId: event.id, action: 'upsert',
      })
    }
  } catch { /* best-effort */ }
  return c.json({ success: true })
})

app.delete('/calendar', async (c) => {
  const { id } = c.req.query()
  if (!id) return c.json({ error: 'id es requerido' }, 400)
  const repo = new D1CalendarRepository(c.env.DB)
  // Leer antes de borrar: el espejo en Google se cancela después del delete local.
  const event = await repo.findById(id, c.get('orgId')).catch(() => null)
  await repo.delete(id, c.get('orgId'))
  if (event?.google_event_id) {
    await mirrorEventToGoogle(c.env, {
      orgId: c.get('orgId'), agentId: event.agent_id, action: 'delete', googleEventId: event.google_event_id,
    })
  }
  return c.json({ success: true })
})

// ── ACTIVITIES ─────────────────────────────────────────────────
app.get('/activities', async (c) => {
  const { agent_id, lead_id, contact_id, property_id, start } = c.req.query()
  const repo = new D1ActivityRepository(c.env.DB)
  const activities = await repo.findByOrg(c.get('orgId'), { agent_id, lead_id, contact_id, property_id, since: start })
  return c.json(activities.map(a => a.toObject?.() ?? a))
})

app.post('/activities', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1ActivityRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()
  try {
    const activity = Activity.create({
      id: idGen.generate(),
      org_id: c.get('orgId'),
      agent_id: c.get('userId'),
      activity_type: body.activity_type,
      description: body.description ?? null,
      result: body.result ?? null,
      duration_minutes: body.duration_minutes ?? null,
      lead_id: body.lead_id || null,
      contact_id: body.contact_id || null,
      property_id: body.property_id || null,
      appraisal_id: body.appraisal_id || null,
    })
    await repo.save(activity)
    return c.json({ id: activity.id })
  } catch (err: any) {
    return c.json({ error: err.message || 'Error al crear actividad' }, 400)
  }
})

app.delete('/activities', async (c) => {
  const { id } = c.req.query()
  const repo = new D1ActivityRepository(c.env.DB)
  await repo.delete(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── TAGS ───────────────────────────────────────────────────────
app.get('/tags', async (c) => {
  const repo = new D1TagRepository(c.env.DB)
  const tags = await repo.findByOrg(c.get('orgId'))
  return c.json(tags.map(t => t.toObject?.() ?? t))
})

app.get('/lead-tags', async (c) => {
  const { lead_id } = c.req.query()
  const repo = new D1TagRepository(c.env.DB)
  const tags = await repo.findByLead(lead_id, c.get('orgId'))
  return c.json(tags.map(t => t.toObject?.() ?? t))
})

app.post('/lead-tags', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1TagRepository(c.env.DB)
  await repo.addToLead(body.lead_id, body.tag_id, c.get('orgId'))
  return c.json({ success: true })
})

app.delete('/lead-tags', async (c) => {
  const { lead_id, tag_id } = c.req.query()
  const repo = new D1TagRepository(c.env.DB)
  await repo.removeFromLead(lead_id, tag_id, c.get('orgId'))
  return c.json({ success: true })
})

app.post('/tags', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1TagRepository(c.env.DB)
  const useCase = new CreateTagUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ org_id: c.get('orgId'), name: body.name, color: body.color })
  return c.json(result, 201)
})

app.delete('/tags', async (c) => {
  const { id } = c.req.query()
  if (!id) return c.json({ error: 'id is required' }, 400)
  const repo = new D1TagRepository(c.env.DB)
  await repo.delete(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── API KEY (LEGACY, deprecado) ────────────────────────────────
// Reemplazado por los API Tokens JWT de abajo (/api-tokens) + POST /v1/leads en
// api-public. Se mantiene operativo para integraciones existentes; sin UI nueva.
app.post('/api-key', async (c) => {
  const repo = new D1OrganizationRepository(c.env.DB)
  const useCase = new GenerateOrgApiKeyUseCase(repo)
  const result = await useCase.execute(c.get('orgId'))
  return c.json(result)
})

app.get('/api-key', async (c) => {
  const repo = new D1OrganizationRepository(c.env.DB)
  const useCase = new GetOrgApiKeyUseCase(repo)
  const result = await useCase.execute(c.get('orgId'))
  return c.json(result)
})

// ── API TOKENS (integración externa, JWT) — sólo admin ─────────
// Gestión de tokens JWT que autentican la API pública /v1/* (ej. importación
// de leads). El JWT en claro se devuelve una única vez al crearlo.
app.get('/api-tokens', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const repo = new D1ApiTokenRepository(c.env.DB)
  const useCase = new ListApiTokensUseCase(repo)
  const tokens = await useCase.execute(c.get('orgId'))
  return c.json(tokens)
})

app.post('/api-tokens', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json().catch(() => ({}))) as any
  if (!body.name || String(body.name).trim().length < 2) {
    return c.json({ error: 'El nombre del token es requerido (mín. 2 caracteres)' }, 400)
  }
  const repo = new D1ApiTokenRepository(c.env.DB)
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  const useCase = new CreateApiTokenUseCase(repo, new CryptoIdGenerator(), authService)
  const result = await useCase.execute({
    orgId: c.get('orgId'),
    name: String(body.name),
    scopes: Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : undefined,
    createdBy: c.get('userId'),
  })
  return c.json(result, 201)
})

// Sin query: revoca (queda en la lista como inactivo). Con ?permanent=1:
// borrado definitivo — desaparece de la lista y el JWT deja de autenticar.
app.delete('/api-tokens/:id', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const repo = new D1ApiTokenRepository(c.env.DB)
  const permanent = c.req.query('permanent') === '1' || c.req.query('permanent') === 'true'
  if (permanent) {
    const useCase = new DeleteApiTokenUseCase(repo)
    await useCase.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  } else {
    const useCase = new RevokeApiTokenUseCase(repo)
    await useCase.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  }
  return c.json({ success: true })
})

// ── WEBHOOKS SALIENTES — sólo admin ─────────────────────────────
// ABM de webhooks que avisan a sistemas externos (n8n) cuando ocurren eventos
// del CRM. El secret firma cada entrega (HMAC-SHA256, X-VendePro-Signature).
const webhookRepos = (env: { DB: D1Database }) => ({
  repo: new D1WebhookRepository(env.DB),
  deliveries: new D1WebhookDeliveryRepository(env.DB),
})

app.get('/webhooks', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const { repo } = webhookRepos(c.env)
  const useCase = new ListWebhooksUseCase(repo)
  return c.json(await useCase.execute(c.get('orgId')))
})

app.post('/webhooks', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json().catch(() => ({}))) as any
  const { repo } = webhookRepos(c.env)
  const useCase = new CreateWebhookUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({
    orgId: c.get('orgId'),
    name: body.name ?? null,
    url: String(body.url ?? ''),
    events: Array.isArray(body.events) ? body.events : [],
  })
  return c.json(result, 201)
})

app.patch('/webhooks/:id', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const body = (await c.req.json().catch(() => ({}))) as any
  const { repo } = webhookRepos(c.env)
  const useCase = new UpdateWebhookUseCase(repo)
  const result = await useCase.execute({
    id: c.req.param('id'),
    orgId: c.get('orgId'),
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.url !== undefined ? { url: String(body.url) } : {}),
    ...(Array.isArray(body.events) ? { events: body.events } : {}),
    ...(typeof body.is_active === 'boolean' ? { is_active: body.is_active } : {}),
  })
  return c.json(result)
})

app.delete('/webhooks/:id', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const { repo } = webhookRepos(c.env)
  const useCase = new DeleteWebhookUseCase(repo)
  await useCase.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  return c.json({ success: true })
})

// Envía un `webhook.test` al hook puntual para verificar el receptor.
app.post('/webhooks/:id/test', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const { repo, deliveries } = webhookRepos(c.env)
  const useCase = new TestWebhookUseCase(repo, deliveries, new HttpWebhookSender(), new CryptoIdGenerator())
  const result = await useCase.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  return c.json(result, result.ok ? 200 : 502)
})

app.get('/webhooks/:id/deliveries', async (c) => {
  const denied = requireAdmin(c); if (denied) return denied
  const { deliveries } = webhookRepos(c.env)
  const useCase = new ListWebhookDeliveriesUseCase(deliveries)
  return c.json(await useCase.execute({ webhookId: c.req.param('id'), orgId: c.get('orgId'), limit: 20 }))
})

// ── STAGE HISTORY ──────────────────────────────────────────────
app.get('/stage-history', async (c) => {
  const { entity_type, entity_id } = c.req.query()
  if (!entity_id) return c.json({ error: 'entity_id is required' }, 400)
  const repo = new D1StageHistoryRepository(c.env.DB)
  const history = await repo.findByEntity(entity_type as any, entity_id as any, c.get('orgId'))
  return c.json(history.map((h: any) => h.toObject?.() ?? h))
})

// ── LANDINGS helpers ───────────────────────────────────────────
const landingDeps = (env: { DB: D1Database }) => ({
  landings: new D1LandingRepository(env.DB),
  templates: new D1LandingTemplateRepository(env.DB),
  versions: new D1LandingVersionRepository(env.DB),
  events: new D1LandingEventRepository(env.DB),
  idGen: new CryptoIdGenerator(),
})

const actor = (c: any) => ({ role: c.get('userRole') as 'admin' | 'agent', userId: c.get('userId') as string })
const orgId = (c: any) => c.get('orgId') as string

// === Landings ===
app.get('/landings', async (c) => {
  const { landings } = landingDeps(c.env)
  const uc = new ListLandingsUseCase(landings)
  const scope = (c.req.query('scope') as any) || 'mine'
  const kind = c.req.query('kind') as any
  const status = c.req.query('status') as any
  const result = await uc.execute({ actor: actor(c), orgId: orgId(c), scope, filters: { kind, status } })
  return c.json({ landings: result.map(l => l.toObject()) })
})

app.get('/landings/:id', async (c) => {
  const { landings } = landingDeps(c.env)
  const uc = new GetLandingUseCase(landings)
  const l = await uc.execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ landing: l.toObject() })
})

app.post('/landings', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, templates, versions, idGen } = landingDeps(c.env)
  const uc = new CreateLandingFromTemplateUseCase(templates, landings, versions, idGen)
  const r = await uc.execute({
    actor: actor(c), orgId: orgId(c),
    templateId: body.templateId,
    slugBase: body.slugBase,
    brandVoice: body.brandVoice ?? null,
    leadRules: body.leadRules ?? null,
    seoTitle: body.seoTitle ?? null,
    seoDescription: body.seoDescription ?? null,
    ogImageUrl: body.ogImageUrl ?? null,
  })
  return c.json(r, 201)
})

app.patch('/landings/:id', async (c) => {
  const body = (await c.req.json()) as any
  const { landings } = landingDeps(c.env)
  await new UpdateLandingMetadataUseCase(landings).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), patch: body.patch,
  })
  return c.json({ ok: true })
})

app.patch('/landings/:id/blocks', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new UpdateLandingBlocksUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    blocks: body.blocks, label: body.label ?? 'manual-save',
  })
  return c.json(r)
})

app.post('/landings/:id/blocks', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new AddBlockUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    block: body.block, insertAtIndex: body.insertAtIndex,
  })
  return c.json(r, 201)
})

app.delete('/landings/:id/blocks/:blockId', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  await new RemoveBlockUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), blockId: c.req.param('blockId'),
  })
  return c.json({ ok: true })
})

app.post('/landings/:id/blocks/reorder', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  await new ReorderBlocksUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    orderedBlockIds: body.orderedBlockIds,
  })
  return c.json({ ok: true })
})

app.patch('/landings/:id/blocks/:blockId/visibility', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  await new ToggleBlockVisibilityUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    blockId: c.req.param('blockId'), visible: body.visible,
  })
  return c.json({ ok: true })
})

app.get('/landings/:id/versions', async (c) => {
  const { versions } = landingDeps(c.env)
  const list = await versions.listByLanding(c.req.param('id'), 50)
  return c.json({ versions: list.map(v => v.toObject()) })
})

app.post('/landings/:id/rollback/:versionId', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new RollbackLandingUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), versionId: c.req.param('versionId'),
  })
  return c.json(r)
})

app.post('/landings/:id/request-publish', async (c) => {
  const { landings } = landingDeps(c.env)
  await new RequestPublishUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.post('/landings/:id/publish', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new PublishLandingUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
  })
  return c.json(r)
})

app.post('/landings/:id/reject-publish', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any
  const { landings } = landingDeps(c.env)
  await new RejectPublishRequestUseCase(landings).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), note: body.note,
  })
  return c.json({ ok: true })
})

app.post('/landings/:id/archive', async (c) => {
  const { landings } = landingDeps(c.env)
  await new ArchiveLandingUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.post('/landings/:id/unarchive', async (c) => {
  const { landings } = landingDeps(c.env)
  await new UnarchiveLandingUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.get('/landings/:id/analytics', async (c) => {
  const { landings, events } = landingDeps(c.env)
  const rangeDays = (parseInt(c.req.query('rangeDays') || '7', 10) as 7 | 14 | 30)
  const r = await new GetLandingAnalyticsUseCase(landings, events).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), rangeDays,
  })
  return c.json({ summary: r })
})

// === Templates ===
app.get('/landing-templates', async (c) => {
  const { templates } = landingDeps(c.env)
  const kind = c.req.query('kind') as any
  const list = await new ListTemplatesUseCase(templates).execute({ orgId: orgId(c), kind })
  return c.json({ templates: list.map(t => t.toObject()) })
})

app.post('/landing-templates', async (c) => {
  const body = (await c.req.json()) as any
  const { templates, idGen } = landingDeps(c.env)
  const r = await new CreateTemplateUseCase(templates, idGen).execute({
    actor: actor(c), orgId: body.global === true ? null : orgId(c),
    name: body.name, kind: body.kind, description: body.description,
    previewImageUrl: body.previewImageUrl, blocks: body.blocks, sortOrder: body.sortOrder,
  })
  return c.json(r, 201)
})

app.patch('/landing-templates/:id', async (c) => {
  const body = (await c.req.json()) as any
  const { templates } = landingDeps(c.env)
  await new UpdateTemplateUseCase(templates).execute({
    actor: actor(c), orgId: orgId(c), templateId: c.req.param('id'), patch: body.patch,
  })
  return c.json({ ok: true })
})

// ── CRON: sync automático de integraciones (cada 15 min, wrangler triggers) ──
// Recorre las orgs con KiteProp habilitado; una org que falla no frena a las
// demás (su error queda en integration_sync_log).
async function runKitepropAutoSync(env: Env): Promise<void> {
  const integrationRepo = new D1OrgIntegrationRepository(env.DB)
  let integrations
  try {
    integrations = await integrationRepo.findEnabledByProvider('kiteprop')
  } catch {
    return // tabla ausente u otro error de infra: el próximo tick reintenta
  }
  for (const integration of integrations) {
    try {
      await buildKitepropSync(env).execute({ orgId: integration.org_id, mode: 'auto' })
    } catch {
      // aislado por org; el detalle queda en el sync log
    }
  }
}

async function scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil(runKitepropAutoSync(env))
}

// El default sigue siendo la app de Hono (los tests usan app.request) con el
// handler `scheduled` adosado: wrangler resuelve default.fetch y default.scheduled.
export default Object.assign(app, { scheduled })
