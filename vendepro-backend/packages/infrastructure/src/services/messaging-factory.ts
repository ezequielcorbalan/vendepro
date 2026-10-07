import type { MessagingGateway, ConversationChannel } from '@vendepro/core'
import { D1OrgIntegrationRepository } from '../repositories/d1-org-integration-repository'
import { WahaMessagingGateway } from './waha-messaging-gateway'
import { MetaMessagingGateway } from './meta-messaging-gateway'
import { decrypt } from './token-encryption'

export const WHATSAPP_PROVIDER = 'whatsapp'
/** Instagram y Facebook comparten integración: una app de Meta, una página. */
export const META_PROVIDER = 'instagram'

export interface MessagingEnv {
  DB: D1Database
  JWT_SECRET: string
}

/**
 * Arma el gateway de mensajería de una organización con lo que tenga
 * configurado, o `null` si no tiene nada.
 *
 * La config vive en `org_integrations` (provider `whatsapp`) y no en variables
 * del worker porque VendéPro es multi-tenant: cada inmobiliaria conecta su
 * propio número. El `config_json` dice a qué proveedor hablarle, así que el
 * día que una org pase a la Cloud API oficial se cambia su fila, no el worker.
 *
 * Devolver `null` en vez de tirar error es a propósito: una org sin WhatsApp
 * configurado no es un fallo, es el estado normal de casi todas. Quien llama
 * decide qué contestar.
 */
export async function createMessagingGateway(
  env: MessagingEnv,
  orgId: string,
  channel: ConversationChannel = 'whatsapp',
): Promise<MessagingGateway | null> {
  // Cada canal tiene su propia fila de integración: una org puede tener
  // Instagram andando y WhatsApp todavía en trámite, o al revés.
  const provider = channel === 'whatsapp' ? WHATSAPP_PROVIDER : META_PROVIDER
  const integration = await new D1OrgIntegrationRepository(env.DB)
    .findByOrgAndProvider(orgId, provider)
    .catch(() => null)

  if (!integration || !integration.enabled) return null

  const config = parseConfig(integration.config_json)
  const secreto = integration.credentials_encrypted
    ? await decrypt(integration.credentials_encrypted, env.JWT_SECRET).catch(() => null)
    : null

  if (channel !== 'whatsapp') {
    // Instagram y Facebook van por la API oficial: el secreto es el page
    // access token de la página vinculada.
    if (!secreto) return null
    return new MetaMessagingGateway({ pageAccessToken: secreto, apiVersion: config.api_version })
  }

  if (!config.base_url) return null
  // WhatsApp arranca con WAHA. Cuando exista el adapter de Cloud API se elige
  // acá por `config.provider` y el resto del sistema no se entera.
  return new WahaMessagingGateway({
    baseUrl: config.base_url,
    session: config.session ?? 'default',
    apiKey: secreto,
  })
}

interface WhatsAppConfig {
  provider?: string
  base_url?: string
  session?: string
  /** Versión de la Graph API para el canal de Meta. */
  api_version?: string
  /** Id de la cuenta de Instagram / página que recibe los webhooks. */
  account_id?: string
}

export function parseConfig(raw: string | null): WhatsAppConfig {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}
