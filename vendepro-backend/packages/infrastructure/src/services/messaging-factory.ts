import type { MessagingGateway } from '@vendepro/core'
import { D1OrgIntegrationRepository } from '../repositories/d1-org-integration-repository'
import { WahaMessagingGateway } from './waha-messaging-gateway'
import { decrypt } from './token-encryption'

export const WHATSAPP_PROVIDER = 'whatsapp'

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
): Promise<MessagingGateway | null> {
  const integration = await new D1OrgIntegrationRepository(env.DB)
    .findByOrgAndProvider(orgId, WHATSAPP_PROVIDER)
    .catch(() => null)

  if (!integration || !integration.enabled) return null

  const config = parseConfig(integration.config_json)
  if (!config.base_url) return null

  const apiKey = integration.credentials_encrypted
    ? await decrypt(integration.credentials_encrypted, env.JWT_SECRET).catch(() => null)
    : null

  // Por ahora el único adapter es WAHA. Cuando exista el de Cloud API, acá se
  // elige por `config.provider` y el resto del sistema no se entera.
  return new WahaMessagingGateway({
    baseUrl: config.base_url,
    session: config.session ?? 'default',
    apiKey,
  })
}

interface WhatsAppConfig {
  provider?: string
  base_url?: string
  session?: string
}

function parseConfig(raw: string | null): WhatsAppConfig {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}
