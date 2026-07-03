import type { WebhookRepository, WebhookDeliveryRepository } from '../../ports/repositories/webhook-repository'
import type { WebhookSender } from '../../ports/services/webhook-sender'
import type { IdGenerator } from '../../ports/id-generator'
import type { Webhook } from '../../../domain/entities/webhook'

export interface DispatchWebhookEventInput {
  orgId: string
  event: string
  payload: Record<string, unknown>
}

export interface DispatchWebhookEventOutput {
  /** Webhooks suscriptos al evento a los que se intentó entregar. */
  dispatched: number
  /** Entregas que terminaron en 2xx. */
  delivered: number
}

/**
 * Entrega un evento a todos los webhooks activos de la org suscriptos a él.
 * Reintento simple: 1 retry ante 5xx/timeout (4xx no se reintenta — es un
 * problema de configuración del receptor). Cada intento queda logueado.
 */
export class DispatchWebhookEventUseCase {
  constructor(
    private readonly repo: WebhookRepository,
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly sender: WebhookSender,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: DispatchWebhookEventInput): Promise<DispatchWebhookEventOutput> {
    const hooks = await this.repo.findActiveByEvent(input.orgId, input.event)
    if (hooks.length === 0) return { dispatched: 0, delivered: 0 }

    const body = JSON.stringify({
      event: input.event,
      timestamp: new Date().toISOString(),
      data: input.payload,
    })

    const results = await Promise.allSettled(hooks.map((h) => this.deliver(h, input, body)))
    const delivered = results.filter((r) => r.status === 'fulfilled' && r.value).length
    return { dispatched: hooks.length, delivered }
  }

  private async deliver(hook: Webhook, input: DispatchWebhookEventInput, body: string): Promise<boolean> {
    let attempts = 1
    let result = await this.sender.send(hook.url, hook.secret, body)
    const retriable = !result.ok && (result.status === null || result.status >= 500)
    if (retriable) {
      attempts = 2
      result = await this.sender.send(hook.url, hook.secret, body)
    }

    await this.deliveries.log({
      id: this.ids.generate(),
      org_id: input.orgId,
      webhook_id: hook.id,
      event: input.event,
      status: result.ok ? 'success' : 'failed',
      http_status: result.status,
      attempts,
      error: result.ok ? null : result.error ?? `HTTP ${result.status}`,
    })
    if (result.ok) await this.repo.touchLastTriggered(hook.id)
    return result.ok
  }
}
