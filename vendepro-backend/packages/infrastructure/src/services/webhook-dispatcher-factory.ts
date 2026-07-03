import {
  DispatchWebhookEventUseCase,
  type DispatchWebhookEventInput,
  type DispatchWebhookEventOutput,
} from '@vendepro/core'
import { D1WebhookRepository } from '../repositories/d1-webhook-repository'
import { D1WebhookDeliveryRepository } from '../repositories/d1-webhook-delivery-repository'
import { HttpWebhookSender } from './http-webhook-sender'
import { CryptoIdGenerator } from './crypto-id-generator'

/**
 * Factory compartida: construye un `DispatchWebhookEventUseCase` ya cableado
 * con los repositorios D1 y el sender HTTP (HMAC-SHA256).
 *
 * Usar desde cada worker que dispare eventos hacia afuera
 * (api-crm, api-properties, api-public).
 */
export function createWebhookDispatcher(env: { DB: D1Database }): DispatchWebhookEventUseCase {
  return new DispatchWebhookEventUseCase(
    new D1WebhookRepository(env.DB),
    new D1WebhookDeliveryRepository(env.DB),
    new HttpWebhookSender(),
    new CryptoIdGenerator(),
  )
}

/**
 * Dispara un evento de webhook "fire-and-forget" — cualquier error se logea
 * y se traga para no bloquear el flujo de negocio (creación de lead/tasación/etc.).
 * Devuelve el resultado detallado o `null` si falló.
 */
export async function fireWebhookEvent(
  env: { DB: D1Database },
  input: DispatchWebhookEventInput,
): Promise<DispatchWebhookEventOutput | null> {
  try {
    const dispatcher = createWebhookDispatcher(env)
    return await dispatcher.execute(input)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhooks] fireWebhookEvent failed (swallowed):', (err as Error)?.message ?? err)
    return null
  }
}
