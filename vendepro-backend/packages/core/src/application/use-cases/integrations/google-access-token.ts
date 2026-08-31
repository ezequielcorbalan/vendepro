import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'
import type { GoogleCalendarGateway } from '../../ports/services/google-calendar-gateway'
import type { UserIntegration } from '../../../domain/entities/user-integration'
import type { TokenEncryptor } from '../marketing/save-meta-integration'
import type { TokenDecryptor } from './test-kiteprop-connection'

/**
 * Credenciales de Google guardadas (cifradas) para un usuario.
 * El refresh token es el que importa: sin él no se puede operar en background.
 */
export interface StoredGoogleCredentials {
  refresh_token: string
  access_token?: string
  expires_at?: string
}

/**
 * Devuelve un access token vigente para la integración, refrescándolo y
 * persistiéndolo si venció. `null` si las credenciales no sirven.
 *
 * Vive acá y no dentro de un use case porque lo necesitan todos los que hablan
 * con Google (espejar un evento, listar el calendario): tener el refresh en un
 * solo lugar evita que un bug de tokens haya que arreglarlo dos veces.
 */
export async function getValidGoogleAccessToken(args: {
  integration: UserIntegration
  repo: UserIntegrationRepository
  gateway: GoogleCalendarGateway
  encryptToken: TokenEncryptor
  decryptToken: TokenDecryptor
}): Promise<string | null> {
  const { integration, repo, gateway, encryptToken, decryptToken } = args

  const plain = await decryptToken(integration.credentials_encrypted as string)
  if (!plain) return null

  let creds: StoredGoogleCredentials
  try {
    creds = JSON.parse(plain) as StoredGoogleCredentials
  } catch {
    return null
  }
  if (!creds.refresh_token) return null

  const stillValid = creds.access_token && creds.expires_at && new Date(creds.expires_at) > new Date()
  if (stillValid) return creds.access_token as string

  const refreshed = await gateway.refreshAccessToken(creds.refresh_token)
  const next: StoredGoogleCredentials = {
    refresh_token: creds.refresh_token,
    access_token: refreshed.access_token,
    // Margen de 60s para no usar un token que vence a mitad de la request.
    expires_at: new Date(Date.now() + Math.max(refreshed.expires_in - 60, 0) * 1000).toISOString(),
  }
  integration.update({
    credentials_encrypted: await encryptToken(JSON.stringify(next)),
    last_sync_at: new Date().toISOString(),
  })
  await repo.save(integration)
  return refreshed.access_token
}
