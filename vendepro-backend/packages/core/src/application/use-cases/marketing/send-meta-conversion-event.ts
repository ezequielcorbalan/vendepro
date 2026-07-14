/**
 * @deprecated — usar `SendMarketingEventUseCase` directo.
 *
 * Este wrapper preserva la API existente (`{orgId, leadId, stageKey, leadDataOverride}`)
 * y delega en el use case multi-proveedor (Meta CAPI + GA4 MP + futuros).
 */
import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import type { StageEventMappingRepository } from '../../ports/repositories/stage-event-mapping-repository'
import type { MetaEventLogRepository } from '../../ports/repositories/meta-event-log-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { MetaConversionAPI, MetaEventPayload } from '../../ports/services/meta-conversion-api'
import type { Ga4MeasurementProtocol } from '../../ports/services/ga4-measurement-protocol'
import {
  SendMarketingEventUseCase,
  type TokenDecryptor,
  type SendMarketingEventOutput,
} from './send-marketing-event'

export interface SendMetaConversionEventInput {
  orgId: string
  /** Agente dueño de la config de pixel a usar (integración por-agente). */
  agentId?: string | null
  leadId: string
  stageKey: string
  leadDataOverride?: {
    full_name?: string | null
    email?: string | null
    phone?: string | null
    estimated_value?: number | null
  } | null
  actionSource?: MetaEventPayload['action_source']
  testEventCodeOverride?: string | null
}

export interface SendMetaConversionEventOutput {
  status: 'noop' | 'sent' | 'failed' | 'disabled'
  reason?: string
  log_id?: string
  event_id?: string
  http_status?: number
  body?: string
  /** Resultado detallado multi-provider. */
  full?: SendMarketingEventOutput
}

export class SendMetaConversionEventUseCase {
  private readonly delegate: SendMarketingEventUseCase

  constructor(
    integrations: MetaIntegrationRepository,
    mappings: StageEventMappingRepository,
    logs: MetaEventLogRepository,
    leads: LeadRepository,
    metaApi: MetaConversionAPI,
    ids: IdGenerator,
    decryptToken: TokenDecryptor,
    /** GA4 api es opcional — si no se pasa, GA4 se omite vía mock no-op. */
    ga4Api?: Ga4MeasurementProtocol,
  ) {
    this.delegate = new SendMarketingEventUseCase(
      integrations,
      mappings,
      logs,
      leads,
      metaApi,
      ga4Api ?? {
        sendEvent: async () => ({ ok: false, status: 0, body: '', error: 'ga4_not_configured' }),
      },
      ids,
      decryptToken,
    )
  }

  async execute(input: SendMetaConversionEventInput): Promise<SendMetaConversionEventOutput> {
    const out = await this.delegate.execute({
      orgId: input.orgId,
      agentId: input.agentId ?? null,
      eventKey: input.stageKey,
      entityType: 'lead',
      entityId: input.leadId,
      leadId: input.leadId,
      userData: input.leadDataOverride ?? null,
      actionSource: input.actionSource,
      testEventCodeOverride: input.testEventCodeOverride ?? null,
    })

    // Colapsar a la forma legacy (sólo Meta).
    const m = out.meta
    if (m.status === 'skipped') {
      return { status: 'noop', reason: m.reason ?? 'skipped', event_id: out.event_id, full: out }
    }
    return {
      status: m.status as SendMetaConversionEventOutput['status'],
      reason: m.reason,
      log_id: m.log_id,
      event_id: out.event_id,
      http_status: m.http_status,
      body: m.body,
      full: out,
    }
  }
}
