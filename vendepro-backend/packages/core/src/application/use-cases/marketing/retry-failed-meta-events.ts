import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import type { MetaEventLogRepository } from '../../ports/repositories/meta-event-log-repository'
import type { MetaConversionAPI } from '../../ports/services/meta-conversion-api'
import type { TokenDecryptor } from './send-marketing-event'

export interface RetryFailedMetaEventsInput {
  orgId: string
  maxAttempts?: number
  limit?: number
}

export interface RetryFailedMetaEventsOutput {
  retried: number
  succeeded: number
  failed: number
}

/**
 * Reintenta eventos en estado 'failed' con attempts < maxAttempts.
 * NOTA: este reintento es minimalista — sólo re-pega el log con un payload
 * mínimo. Para un retry completo se podría persistir el payload original,
 * pero por ahora alcanza con notificar a Meta usando el event_id ya generado.
 *
 * TODO: persistir payload original o regenerarlo desde el lead_id si existe.
 */
export class RetryFailedMetaEventsUseCase {
  constructor(
    private readonly integrations: MetaIntegrationRepository,
    private readonly logs: MetaEventLogRepository,
    private readonly api: MetaConversionAPI,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: RetryFailedMetaEventsInput): Promise<RetryFailedMetaEventsOutput> {
    const maxAttempts = input.maxAttempts ?? 3
    const limit = input.limit ?? 25

    const failed = await this.logs.findFailedToRetry(input.orgId, maxAttempts, limit)
    let succeeded = 0
    let stillFailed = 0

    // La integración es por-agente: resolvemos la config del agente dueño de
    // cada log (cache por agente). Logs sin agente o con integración
    // deshabilitada se saltan.
    const cache = new Map<string, { pixelId: string; token: string; stape: string | null; testCode: string | null } | null>()
    const resolve = async (agentId: string | null) => {
      if (!agentId) return null
      if (cache.has(agentId)) return cache.get(agentId)!
      const integration = await this.integrations.findByAgent(agentId)
      let resolved: { pixelId: string; token: string; stape: string | null; testCode: string | null } | null = null
      if (integration && integration.enabled && integration.pixel_id && integration.access_token_encrypted) {
        const token = await this.decryptToken(integration.access_token_encrypted)
        if (token) {
          resolved = { pixelId: integration.pixel_id, token, stape: integration.stape_endpoint, testCode: integration.test_event_code }
        }
      }
      cache.set(agentId, resolved)
      return resolved
    }

    let retried = 0
    for (const log of failed) {
      const cfg = await resolve(log.agent_id)
      if (!cfg) continue
      retried++
      log.incrementAttempts()
      const result = await this.api.sendEvent({
        pixelId: cfg.pixelId,
        accessToken: cfg.token,
        endpoint: cfg.stape ?? 'https://graph.facebook.com',
        payload: {
          event_name: log.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: log.event_id,
          action_source: 'system_generated',
          user_data: {},
        },
        testEventCode: cfg.testCode,
      })
      if (result.ok) {
        log.markSent(result.status, result.body.slice(0, 4000))
        succeeded++
      } else {
        log.markFailed(result.error ?? `HTTP ${result.status}`, result.status, result.body.slice(0, 4000))
        stillFailed++
      }
      await this.logs.save(log)
    }

    return { retried, succeeded, failed: stillFailed }
  }
}
