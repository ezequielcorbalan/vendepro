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

    const integration = await this.integrations.findByOrg(input.orgId)
    if (!integration || !integration.enabled || !integration.pixel_id || !integration.access_token_encrypted) {
      return { retried: 0, succeeded: 0, failed: 0 }
    }
    const accessToken = await this.decryptToken(integration.access_token_encrypted)
    if (!accessToken) return { retried: 0, succeeded: 0, failed: 0 }

    const failed = await this.logs.findFailedToRetry(input.orgId, maxAttempts, limit)
    let succeeded = 0
    let stillFailed = 0

    for (const log of failed) {
      log.incrementAttempts()
      const result = await this.api.sendEvent({
        pixelId: integration.pixel_id,
        accessToken,
        endpoint: integration.stape_endpoint ?? 'https://graph.facebook.com',
        payload: {
          event_name: log.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: log.event_id,
          action_source: 'system_generated',
          user_data: {},
        },
        testEventCode: integration.test_event_code,
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

    return { retried: failed.length, succeeded, failed: stillFailed }
  }
}
