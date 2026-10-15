import type { MessagingGateway, ConversationChannel } from '@vendepro/core'
import { D1OrgIntegrationRepository } from '../repositories/d1-org-integration-repository'
import { WahaMessagingGateway } from './waha-messaging-gateway'
import { MetaMessagingGateway } from './meta-messaging-gateway'
import { decrypt } from './token-encryption'

export const WHATSAPP_PROVIDER = 'whatsapp'
/** Instagram y Facebook comparten integración: una app de Meta, una página. */
export const META_PROVIDER = 'instagram'
/** Messenger: misma API de Meta que Instagram, pero otra página y otro token. */
export const FACEBOOK_PROVIDER = 'facebook'

/** La fila de `org_integrations` de cada canal. */
export function providerDeCanal(channel: ConversationChannel): string {
  if (channel === 'whatsapp') return WHATSAPP_PROVIDER
  return channel === 'facebook' ? FACEBOOK_PROVIDER : META_PROVIDER
}

export interface MessagingEnv {
  DB: D1Database
  JWT_SECRET: string
  /** WAHA de la plataforma: el que usan las orgs que no hospedan el suyo. */
  WAHA_BASE_URL?: string
  WAHA_API_KEY?: string
}

/**
 * Nombre de la sesión de una org en el WAHA compartido.
 *
 * Vive acá y no en un worker porque lo necesitan dos: api-crm al conectar y
 * al mandar como agente, y api-public cuando manda el bot. Si cada uno lo
 * calculara por su lado, un cambio en uno dejaría al bot mandando a una
 * sesión que no existe.
 */
export function sessionDeOrg(orgId: string): string {
  return `org-${orgId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`
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
/**
 * Credenciales de Instagram o Messenger de una org, para llamadas que no son
 * mandar un mensaje (ej. el perfil de quien escribe). `null` si no está conectado.
 */
export async function metaConfigDeOrg(
  env: MessagingEnv,
  orgId: string,
  channel: 'instagram' | 'facebook',
): Promise<{ pageAccessToken: string; apiVersion?: string } | null> {
  const integration = await new D1OrgIntegrationRepository(env.DB)
    .findByOrgAndProvider(orgId, providerDeCanal(channel))
    .catch(() => null)
  if (!integration?.enabled || !integration.credentials_encrypted) return null
  const token = await decrypt(integration.credentials_encrypted, env.JWT_SECRET).catch(() => null)
  return token ? { pageAccessToken: token, apiVersion: parseConfig(integration.config_json).api_version } : null
}

export async function createMessagingGateway(
  env: MessagingEnv,
  orgId: string,
  channel: ConversationChannel = 'whatsapp',
): Promise<MessagingGateway | null> {
  // Cada canal tiene su propia fila de integración: una org puede tener
  // Instagram andando y WhatsApp todavía en trámite, o al revés.
  const provider = providerDeCanal(channel)
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

  // Sin URL propia, el WAHA de la plataforma: es el caso normal. Antes esto
  // exigía `base_url` en la org, así que en el modelo compartido la conexión
  // andaba pero mandar un mensaje no — lo encontró la prueba de punta a punta.
  const baseUrl = config.base_url || env.WAHA_BASE_URL
  if (!baseUrl) return null
  // WhatsApp arranca con WAHA. Cuando exista el adapter de Cloud API se elige
  // acá por `config.provider` y el resto del sistema no se entera.
  return new WahaMessagingGateway({
    baseUrl,
    session: config.session || sessionDeOrg(orgId),
    apiKey: config.base_url ? secreto : (env.WAHA_API_KEY ?? null),
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
