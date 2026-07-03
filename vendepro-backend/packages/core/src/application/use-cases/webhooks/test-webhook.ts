import type { WebhookRepository, WebhookDeliveryRepository } from '../../ports/repositories/webhook-repository'
import type { WebhookSender, WebhookSendResult } from '../../ports/services/webhook-sender'
import type { IdGenerator } from '../../ports/id-generator'
import { ValidationError } from '../../../domain/errors/validation-error'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface TestWebhookInput {
  id: string
  orgId: string
}

/**
 * Envía un evento `webhook.test` a un webhook puntual (aunque esté inactivo)
 * para verificar la configuración del receptor. Sin retry: el resultado del
 * único intento se devuelve tal cual a la UI.
 */
export class TestWebhookUseCase {
  constructor(
    private readonly repo: WebhookRepository,
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly sender: WebhookSender,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: TestWebhookInput): Promise<WebhookSendResult> {
    if (!input.id) throw new ValidationError('id de webhook requerido')
    const hook = await this.repo.findById(input.id, input.orgId)
    if (!hook) throw new NotFoundError('Webhook', input.id)

    const body = JSON.stringify({
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Prueba de webhook desde VendéPro. Si leés esto, la configuración funciona.' },
    })
    const result = await this.sender.send(hook.url, hook.secret, body)

    await this.deliveries.log({
      id: this.ids.generate(),
      org_id: input.orgId,
      webhook_id: hook.id,
      event: 'webhook.test',
      status: result.ok ? 'success' : 'failed',
      http_status: result.status,
      attempts: 1,
      error: result.ok ? null : result.error ?? `HTTP ${result.status}`,
    })
    if (result.ok) await this.repo.touchLastTriggered(hook.id)
    return result
  }
}
