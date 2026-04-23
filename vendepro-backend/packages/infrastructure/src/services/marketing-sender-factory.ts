import {
  SendMarketingEventUseCase,
  type SendMarketingEventInput,
  type SendMarketingEventOutput,
} from '@vendepro/core'
import { D1MetaIntegrationRepository } from '../repositories/d1-meta-integration-repository'
import { D1StageEventMappingRepository } from '../repositories/d1-stage-event-mapping-repository'
import { D1MetaEventLogRepository } from '../repositories/d1-meta-event-log-repository'
import { D1LeadRepository } from '../repositories/d1-lead-repository'
import { MetaConversionAPIHttp } from './meta-conversion-api-http'
import { Ga4MeasurementProtocolHttp } from './ga4-measurement-protocol-http'
import { CryptoIdGenerator } from './crypto-id-generator'
import { decrypt } from './token-encryption'

/**
 * Factory compartida: construye un `SendMarketingEventUseCase` ya cableado
 * con los repositorios D1 y los adapters HTTP (Meta CAPI + GA4 MP).
 *
 * Usar desde cada worker que necesite disparar eventos de marketing
 * (api-crm, api-properties, api-transactions, api-public).
 */
export function createMarketingSender(
  env: { DB: D1Database; JWT_SECRET: string },
  idGen: CryptoIdGenerator = new CryptoIdGenerator(),
): SendMarketingEventUseCase {
  return new SendMarketingEventUseCase(
    new D1MetaIntegrationRepository(env.DB),
    new D1StageEventMappingRepository(env.DB),
    new D1MetaEventLogRepository(env.DB),
    new D1LeadRepository(env.DB),
    new MetaConversionAPIHttp(),
    new Ga4MeasurementProtocolHttp(),
    idGen,
    (cipher: string) => decrypt(cipher, env.JWT_SECRET),
  )
}

/**
 * Dispara un evento de marketing "fire-and-forget" — cualquier error se logea
 * y se traga para no bloquear el flujo de negocio (creación de lead/tasación/etc.).
 * Devuelve el resultado detallado o `null` si falló.
 */
export async function fireMarketingEvent(
  env: { DB: D1Database; JWT_SECRET: string },
  input: SendMarketingEventInput,
): Promise<SendMarketingEventOutput | null> {
  try {
    const sender = createMarketingSender(env)
    return await sender.execute(input)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[marketing] fireMarketingEvent failed (swallowed):', (err as Error)?.message ?? err)
    return null
  }
}
