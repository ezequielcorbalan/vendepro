import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import type { StageEventMappingRepository } from '../../ports/repositories/stage-event-mapping-repository'
import type { MetaEventLogRepository } from '../../ports/repositories/meta-event-log-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { MetaConversionAPI, MetaEventPayload, MetaUserData } from '../../ports/services/meta-conversion-api'
import { MetaEventLog } from '../../../domain/entities/meta-event-log'

/**
 * Desencriptador inyectable: recibe ciphertext (formato `iv:cipher` b64) y
 * devuelve plaintext o null.
 */
export type TokenDecryptor = (ciphertext: string) => Promise<string | null>

export interface SendMetaConversionEventInput {
  orgId: string
  leadId: string
  stageKey: string
  /** Si se omite, intenta obtener desde el lead — pero se permite override (test event) */
  leadDataOverride?: {
    full_name?: string | null
    email?: string | null
    phone?: string | null
    estimated_value?: number | null
  } | null
  /** Origen reportado a Meta. Default: 'system_generated' (cambio de etapa interno). */
  actionSource?: MetaEventPayload['action_source']
  /** test_event_code one-shot — sobrescribe el de la integración. */
  testEventCodeOverride?: string | null
}

export interface SendMetaConversionEventOutput {
  status: 'noop' | 'sent' | 'failed' | 'disabled'
  reason?: string
  log_id?: string
  event_id?: string
  http_status?: number
  body?: string
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

export class SendMetaConversionEventUseCase {
  constructor(
    private readonly integrations: MetaIntegrationRepository,
    private readonly mappings: StageEventMappingRepository,
    private readonly logs: MetaEventLogRepository,
    private readonly leads: LeadRepository,
    private readonly api: MetaConversionAPI,
    private readonly ids: IdGenerator,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: SendMetaConversionEventInput): Promise<SendMetaConversionEventOutput> {
    const integration = await this.integrations.findByOrg(input.orgId)
    if (!integration) return { status: 'noop', reason: 'no_integration' }
    if (!integration.enabled) return { status: 'disabled', reason: 'integration_disabled' }
    if (!integration.pixel_id || !integration.access_token_encrypted) {
      return { status: 'noop', reason: 'missing_pixel_or_token' }
    }

    const mapping = await this.mappings.findByOrgAndStage(input.orgId, input.stageKey)
    if (!mapping || !mapping.enabled) return { status: 'noop', reason: 'no_mapping' }

    // Intentar desencriptar el access_token
    const accessToken = await this.decryptToken(integration.access_token_encrypted)
    if (!accessToken) return { status: 'failed', reason: 'token_decrypt_failed' }

    // Cargar datos del lead (a menos que vengan override — caso test event)
    let leadData = input.leadDataOverride ?? null
    if (!leadData && input.leadId) {
      const lead = await this.leads.findById(input.leadId, input.orgId)
      if (lead) {
        leadData = {
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          estimated_value: lead.estimated_value,
        }
      }
    }

    // Hashear PII
    const user_data: MetaUserData = {}
    const email = normalizeEmail(leadData?.email)
    if (email) user_data.em = [await sha256Hex(email)]
    const phone = normalizePhone(leadData?.phone)
    if (phone) user_data.ph = [await sha256Hex(phone)]
    const { fn, ln } = normalizeName(leadData?.full_name ?? null)
    if (fn) user_data.fn = [await sha256Hex(fn)]
    if (ln) user_data.ln = [await sha256Hex(ln)]
    if (input.leadId) user_data.external_id = [await sha256Hex(input.leadId)]

    // event_id determinístico para idempotencia (Meta dedupes by event_id)
    const ymd = ymdToday()
    const eventId = await sha256Hex(`${input.orgId}:${input.leadId}:${input.stageKey}:${ymd}`)

    // Guardar log inicial 'pending'
    const log = MetaEventLog.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      lead_id: input.leadId || null,
      event_id: eventId,
      event_name: mapping.meta_event_name,
      status: 'pending',
      attempts: 0,
    })
    log.incrementAttempts()
    await this.logs.save(log)

    const payload: MetaEventPayload = {
      event_name: mapping.meta_event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: input.actionSource ?? ACTION_SOURCE_DEFAULT,
      user_data,
      custom_data: {
        currency: 'USD',
        ...(typeof leadData?.estimated_value === 'number'
          ? { value: leadData.estimated_value }
          : {}),
        stage_key: input.stageKey,
      },
    }

    const result = await this.api.sendEvent({
      pixelId: integration.pixel_id,
      accessToken,
      endpoint: integration.stape_endpoint ?? 'https://graph.facebook.com',
      payload,
      testEventCode: input.testEventCodeOverride ?? integration.test_event_code,
    })

    if (result.ok) {
      log.markSent(result.status, result.body.slice(0, 4000))
      await this.logs.save(log)
      return { status: 'sent', log_id: log.id, event_id: eventId, http_status: result.status, body: result.body }
    }

    log.markFailed(result.error ?? `HTTP ${result.status}`, result.status, result.body.slice(0, 4000))
    await this.logs.save(log)
    return { status: 'failed', log_id: log.id, event_id: eventId, http_status: result.status, body: result.body, reason: result.error }
  }
}
