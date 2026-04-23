import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import type { StageEventMappingRepository } from '../../ports/repositories/stage-event-mapping-repository'
import type { MetaEventLogRepository } from '../../ports/repositories/meta-event-log-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { MetaConversionAPI, MetaEventPayload, MetaUserData } from '../../ports/services/meta-conversion-api'
import type { Ga4MeasurementProtocol, Ga4Event } from '../../ports/services/ga4-measurement-protocol'
import { MetaEventLog } from '../../../domain/entities/meta-event-log'

export type TokenDecryptor = (ciphertext: string) => Promise<string | null>

export interface MarketingUserData {
  full_name?: string | null
  email?: string | null
  phone?: string | null
  estimated_value?: number | null
  client_ip_address?: string | null
  client_user_agent?: string | null
  external_id?: string | null
}

export interface SendMarketingEventInput {
  orgId: string
  /** Clave lógica del evento — ej. stage del lead, 'lead_created', 'appraisal_created'. */
  eventKey: string
  /** Tipo de entidad CRM que originó el evento. */
  entityType?: string | null
  entityId?: string | null
  /** Back-compat: si se pasa y entityId/entityType no, se asume entityType='lead'. */
  leadId?: string | null
  userData?: MarketingUserData | null
  customData?: Record<string, unknown> | null
  actionSource?: MetaEventPayload['action_source']
  testEventCodeOverride?: string | null
  /** GA4 client_id — usar visitor_id del navegador. Si no, derivamos de entityId/leadId. */
  ga4ClientId?: string | null
  eventSourceUrl?: string | null
}

export type ProviderStatus = 'noop' | 'sent' | 'failed' | 'disabled' | 'skipped'

export interface ProviderResult {
  status: ProviderStatus
  reason?: string
  log_id?: string
  http_status?: number
  body?: string
  event_name?: string
}

export interface SendMarketingEventOutput {
  event_id: string
  meta: ProviderResult
  ga4: ProviderResult
}

const ACTION_SOURCE_DEFAULT: MetaEventPayload['action_source'] = 'system_generated'

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function ymdToday(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function normalizeEmail(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.trim().toLowerCase()
  return t || null
}

function normalizePhone(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.replace(/[^\d]/g, '')
  return t || null
}

function normalizeName(s: string | null | undefined): { fn: string | null; ln: string | null } {
  if (!s) return { fn: null, ln: null }
  const parts = s.trim().toLowerCase().split(/\s+/)
  const fn = parts[0] ?? null
  const ln = parts.length > 1 ? parts.slice(1).join(' ') : null
  return { fn, ln }
}

export class SendMarketingEventUseCase {
  constructor(
    private readonly integrations: MetaIntegrationRepository,
    private readonly mappings: StageEventMappingRepository,
    private readonly logs: MetaEventLogRepository,
    private readonly leads: LeadRepository,
    private readonly metaApi: MetaConversionAPI,
    private readonly ga4Api: Ga4MeasurementProtocol,
    private readonly ids: IdGenerator,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: SendMarketingEventInput): Promise<SendMarketingEventOutput> {
    const entityType = input.entityType ?? (input.leadId ? 'lead' : null)
    const entityId = input.entityId ?? input.leadId ?? null

    // event_id determinístico para deduplicación entre Pixel (cliente) y CAPI/GA4 (server).
    // Mismo org+entidad+evento+día → mismo event_id (Meta y GA4 dedupen).
    const ymd = ymdToday()
    const idSeed = `${input.orgId}:${entityType ?? 'unknown'}:${entityId ?? 'none'}:${input.eventKey}:${ymd}`
    const eventId = await sha256Hex(idSeed)

    const out: SendMarketingEventOutput = {
      event_id: eventId,
      meta: { status: 'skipped' },
      ga4: { status: 'skipped' },
    }

    const integration = await this.integrations.findByOrg(input.orgId)
    if (!integration) {
      out.meta = { status: 'noop', reason: 'no_integration' }
      out.ga4 = { status: 'noop', reason: 'no_integration' }
      return out
    }

    const mapping = await this.mappings.findByOrgAndStage(input.orgId, input.eventKey)
    if (!mapping || !mapping.enabled) {
      out.meta = { status: 'noop', reason: 'no_mapping' }
      out.ga4 = { status: 'noop', reason: 'no_mapping' }
      return out
    }

    // Cargar datos de lead para enriquecer user_data si se pasó leadId pero no userData.
    let userData: MarketingUserData | null = input.userData ?? null
    if (!userData && input.leadId) {
      const lead = await this.leads.findById(input.leadId, input.orgId)
      if (lead) {
        userData = {
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          estimated_value: lead.estimated_value,
        }
      }
    }

    // Hashear PII compartido por ambos proveedores.
    const hashedEmail = userData?.email ? await sha256Hex(normalizeEmail(userData.email) ?? '') : null
    const hashedPhone = userData?.phone ? await sha256Hex(normalizePhone(userData.phone) ?? '') : null
    const { fn, ln } = normalizeName(userData?.full_name ?? null)
    const hashedFn = fn ? await sha256Hex(fn) : null
    const hashedLn = ln ? await sha256Hex(ln) : null
    const externalId = userData?.external_id
      ? await sha256Hex(userData.external_id)
      : entityId
        ? await sha256Hex(entityId)
        : null

    const customData = {
      currency: 'USD',
      ...(typeof userData?.estimated_value === 'number' ? { value: userData.estimated_value } : {}),
      stage_key: input.eventKey,
      entity_type: entityType ?? 'unknown',
      ...(entityId ? { entity_id: entityId } : {}),
      ...(input.customData ?? {}),
    }

    // ─── Meta CAPI ─────────────────────────────────────────────
    out.meta = await this.sendMeta({
      orgId: input.orgId,
      integration,
      eventName: mapping.meta_event_name,
      eventId,
      entityType,
      entityId,
      leadId: input.leadId ?? null,
      hashedEmail,
      hashedPhone,
      hashedFn,
      hashedLn,
      externalId,
      customData,
      clientIp: userData?.client_ip_address ?? null,
      clientUa: userData?.client_user_agent ?? null,
      actionSource: input.actionSource ?? ACTION_SOURCE_DEFAULT,
      testEventCode: input.testEventCodeOverride ?? integration.test_event_code,
      eventSourceUrl: input.eventSourceUrl ?? null,
    })
    out.meta.event_name = mapping.meta_event_name

    // ─── GA4 Measurement Protocol ──────────────────────────────
    if (mapping.ga4_event_name && mapping.ga4_event_name.trim().length > 0) {
      out.ga4 = await this.sendGa4({
        orgId: input.orgId,
        integration,
        eventName: mapping.ga4_event_name,
        eventId,
        entityType,
        entityId,
        leadId: input.leadId ?? null,
        hashedEmail,
        hashedPhone,
        customData,
        clientId: input.ga4ClientId ?? (entityId ? `entity.${entityId}` : `server.${this.ids.generate()}`),
      })
      out.ga4.event_name = mapping.ga4_event_name
    } else {
      out.ga4 = { status: 'noop', reason: 'no_ga4_mapping' }
    }

    return out
  }

  private async sendMeta(args: {
    orgId: string
    integration: { pixel_id: string | null; access_token_encrypted: string | null; stape_endpoint: string | null; enabled: boolean }
    eventName: string
    eventId: string
    entityType: string | null
    entityId: string | null
    leadId: string | null
    hashedEmail: string | null
    hashedPhone: string | null
    hashedFn: string | null
    hashedLn: string | null
    externalId: string | null
    customData: Record<string, unknown>
    clientIp: string | null
    clientUa: string | null
    actionSource: MetaEventPayload['action_source']
    testEventCode: string | null
    eventSourceUrl: string | null
  }): Promise<ProviderResult> {
    const { integration } = args
    if (!integration.enabled) return { status: 'disabled', reason: 'meta_disabled' }
    if (!integration.pixel_id || !integration.access_token_encrypted) {
      return { status: 'noop', reason: 'missing_pixel_or_token' }
    }

    const accessToken = await this.decryptToken(integration.access_token_encrypted)
    if (!accessToken) return { status: 'failed', reason: 'token_decrypt_failed' }

    const user_data: MetaUserData = {}
    if (args.hashedEmail) user_data.em = [args.hashedEmail]
    if (args.hashedPhone) user_data.ph = [args.hashedPhone]
    if (args.hashedFn) user_data.fn = [args.hashedFn]
    if (args.hashedLn) user_data.ln = [args.hashedLn]
    if (args.externalId) user_data.external_id = [args.externalId]
    if (args.clientIp) user_data.client_ip_address = args.clientIp
    if (args.clientUa) user_data.client_user_agent = args.clientUa

    const log = MetaEventLog.create({
      id: this.ids.generate(),
      org_id: args.orgId,
      provider: 'meta',
      entity_type: args.entityType,
      entity_id: args.entityId,
      lead_id: args.leadId,
      event_id: args.eventId,
      event_name: args.eventName,
      status: 'pending',
    })
    log.incrementAttempts()
    await this.logs.save(log)

    const payload: MetaEventPayload = {
      event_name: args.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: args.eventId,
      action_source: args.actionSource,
      user_data,
      custom_data: args.customData,
      ...(args.eventSourceUrl ? { event_source_url: args.eventSourceUrl } : {}),
    }

    const result = await this.metaApi.sendEvent({
      pixelId: integration.pixel_id,
      accessToken,
      endpoint: integration.stape_endpoint ?? 'https://graph.facebook.com',
      payload,
      testEventCode: args.testEventCode,
    })

    if (result.ok) {
      log.markSent(result.status, result.body.slice(0, 4000))
      await this.logs.save(log)
      return { status: 'sent', log_id: log.id, http_status: result.status, body: result.body }
    }
    log.markFailed(result.error ?? `HTTP ${result.status}`, result.status, result.body.slice(0, 4000))
    await this.logs.save(log)
    return { status: 'failed', log_id: log.id, http_status: result.status, body: result.body, reason: result.error }
  }

  private async sendGa4(args: {
    orgId: string
    integration: {
      ga4_enabled: boolean
      ga4_measurement_id: string | null
      ga4_api_secret_encrypted: string | null
      stape_endpoint: string | null
    }
    eventName: string
    eventId: string
    entityType: string | null
    entityId: string | null
    leadId: string | null
    hashedEmail: string | null
    hashedPhone: string | null
    customData: Record<string, unknown>
    clientId: string
  }): Promise<ProviderResult> {
    const { integration } = args
    if (!integration.ga4_enabled) return { status: 'disabled', reason: 'ga4_disabled' }
    if (!integration.ga4_measurement_id || !integration.ga4_api_secret_encrypted) {
      return { status: 'noop', reason: 'missing_ga4_credentials' }
    }

    const apiSecret = await this.decryptToken(integration.ga4_api_secret_encrypted)
    if (!apiSecret) return { status: 'failed', reason: 'ga4_api_secret_decrypt_failed' }

    // Los params válidos en MP son strings/numbers/booleans. Convertimos custom_data.
    const params: Record<string, string | number | boolean> = { event_id: args.eventId }
    for (const [k, v] of Object.entries(args.customData)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') params[k] = v
    }
    if (args.hashedEmail) params.email_sha256 = args.hashedEmail
    if (args.hashedPhone) params.phone_sha256 = args.hashedPhone

    const event: Ga4Event = { name: args.eventName, params }

    const log = MetaEventLog.create({
      id: this.ids.generate(),
      org_id: args.orgId,
      provider: 'ga4',
      entity_type: args.entityType,
      entity_id: args.entityId,
      lead_id: args.leadId,
      event_id: args.eventId,
      event_name: args.eventName,
      status: 'pending',
    })
    log.incrementAttempts()
    await this.logs.save(log)

    const result = await this.ga4Api.sendEvent({
      measurementId: integration.ga4_measurement_id,
      apiSecret,
      endpoint: integration.stape_endpoint ?? 'https://www.google-analytics.com',
      clientId: args.clientId,
      events: [event],
    })

    if (result.ok) {
      log.markSent(result.status, (result.body || '').slice(0, 4000))
      await this.logs.save(log)
      return { status: 'sent', log_id: log.id, http_status: result.status, body: result.body }
    }
    log.markFailed(result.error ?? `HTTP ${result.status}`, result.status, (result.body || '').slice(0, 4000))
    await this.logs.save(log)
    return { status: 'failed', log_id: log.id, http_status: result.status, body: result.body, reason: result.error }
  }
}
