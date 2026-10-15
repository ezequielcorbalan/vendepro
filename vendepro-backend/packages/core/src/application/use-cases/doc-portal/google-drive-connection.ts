import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { GoogleCalendarGateway } from '../../ports/services/google-calendar-gateway'
import type { CloudDocumentStorage } from '../../ports/services/cloud-document-storage'
import type { IdGenerator } from '../../ports/id-generator'
import type { TokenEncryptor } from '../marketing/save-meta-integration'
import type { TokenDecryptor } from '../integrations/test-kiteprop-connection'
import { OrgIntegration } from '../../../domain/entities/org-integration'
import { GOOGLE_DRIVE_PROVIDER } from '../../../domain/entities/doc-portal'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { ValidationError } from '../../../domain/errors/validation-error'

/**
 * `drive.file`: VendéPro sólo ve lo que crea él. No es un scope restringido
 * (no pide auditoría de seguridad de Google) y alcanza para el portal.
 */
export const GOOGLE_DRIVE_REQUIRED_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const GOOGLE_DRIVE_SCOPES = `${GOOGLE_DRIVE_REQUIRED_SCOPE} openid email`
export const DRIVE_ROOT_FOLDER_NAME = 'VendéPro — Documentación'

/** El Google OAuth (canje y refresh) es el mismo cliente que usa Calendar. */
export type GoogleOAuthGateway = Pick<GoogleCalendarGateway, 'exchangeCode' | 'refreshAccessToken' | 'revokeToken'>

interface StoredCredentials {
  refresh_token: string
  access_token?: string
  expires_at?: string
}

const isAdmin = (role: string) => role === 'admin' || role === 'owner'

export interface GoogleDriveStatus {
  connected: boolean
  email: string | null
  root_folder_url: string | null
}

export class GetGoogleDriveStatusUseCase {
  constructor(private readonly repo: OrgIntegrationRepository) {}

  async execute(orgId: string): Promise<GoogleDriveStatus> {
    const integration = await this.repo.findByOrgAndProvider(orgId, GOOGLE_DRIVE_PROVIDER)
    const cfg = integration?.getConfig() ?? {}
    return {
      connected: !!integration?.enabled && !!integration.credentials_encrypted,
      email: typeof cfg.email === 'string' ? cfg.email : null,
      root_folder_url: typeof cfg.root_folder_url === 'string' ? cfg.root_folder_url : null,
    }
  }
}

export interface ConnectGoogleDriveInput {
  orgId: string
  code: string
  redirectUri: string
}

/**
 * Canjea el code y deja creada la carpeta raíz en el Drive de la inmobiliaria.
 * Es una conexión de la ORG (la hace un admin), no de un agente: los archivos
 * no pueden depender de que un agente siga en la empresa.
 */
export class ConnectGoogleDriveUseCase {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly oauth: GoogleOAuthGateway,
    private readonly storageFor: (accessToken: string) => CloudDocumentStorage,
    private readonly ids: IdGenerator,
    private readonly encrypt: TokenEncryptor,
  ) {}

  async execute(input: ConnectGoogleDriveInput): Promise<GoogleDriveStatus> {
    const tokens = await this.oauth.exchangeCode(input.code, input.redirectUri)
    if (!tokens.refresh_token) {
      throw new ValidationError('Google no devolvió refresh token; reintentá la conexión')
    }
    const granted = (tokens.scope ?? '').split(/\s+/).filter(Boolean)
    if (granted.length > 0 && !granted.includes(GOOGLE_DRIVE_REQUIRED_SCOPE)) {
      throw new ValidationError('Faltó aceptar el permiso de Google Drive. Reintentá y dejá tildada la casilla de Drive.')
    }

    const root = await this.storageFor(tokens.access_token).ensureRootFolder(DRIVE_ROOT_FOLDER_NAME)

    const credentials: StoredCredentials = {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + Math.max(tokens.expires_in - 60, 0) * 1000).toISOString(),
    }
    const existing = await this.repo.findByOrgAndProvider(input.orgId, GOOGLE_DRIVE_PROVIDER)
    const integration = existing ?? OrgIntegration.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      provider: GOOGLE_DRIVE_PROVIDER,
      name: 'Google Drive',
    })
    integration.update({ credentials_encrypted: await this.encrypt(JSON.stringify(credentials)), enabled: true })
    integration.setConfig({
      email: tokens.email ?? null,
      root_folder_id: root.id,
      root_folder_url: root.url,
      scopes: granted.join(' ') || null,
    })
    await this.repo.save(integration)
    return { connected: true, email: tokens.email ?? null, root_folder_url: root.url }
  }
}

/** Desconecta y revoca el token. Los archivos quedan en el Drive de la inmobiliaria. */
export class DisconnectGoogleDriveUseCase {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly oauth: GoogleOAuthGateway,
    private readonly decrypt: TokenDecryptor,
  ) {}

  async execute(orgId: string, role: string): Promise<GoogleDriveStatus> {
    if (!isAdmin(role)) throw new ForbiddenError('Sólo un administrador puede desconectar el Drive')
    const integration = await this.repo.findByOrgAndProvider(orgId, GOOGLE_DRIVE_PROVIDER)
    if (integration?.credentials_encrypted) {
      const plain = await this.decrypt(integration.credentials_encrypted).catch(() => null)
      try {
        const creds = plain ? (JSON.parse(plain) as StoredCredentials) : null
        if (creds?.refresh_token) await this.oauth.revokeToken(creds.refresh_token)
      } catch { /* best-effort */ }
      integration.update({ credentials_encrypted: null, enabled: false })
      await this.repo.save(integration)
    }
    return { connected: false, email: null, root_folder_url: null }
  }
}

/**
 * Access token vigente de la org y su carpeta raíz, refrescando si venció.
 * null si no está conectada o el token ya no sirve (revocado desde Google).
 */
export async function getOrgDriveAccess(args: {
  orgId: string
  repo: OrgIntegrationRepository
  oauth: GoogleOAuthGateway
  encrypt: TokenEncryptor
  decrypt: TokenDecryptor
}): Promise<{ accessToken: string; rootFolderId: string } | null> {
  const integration = await args.repo.findByOrgAndProvider(args.orgId, GOOGLE_DRIVE_PROVIDER)
  if (!integration?.enabled || !integration.credentials_encrypted) return null
  const rootFolderId = integration.getConfig().root_folder_id
  if (typeof rootFolderId !== 'string' || !rootFolderId) return null

  const plain = await args.decrypt(integration.credentials_encrypted)
  if (!plain) return null
  let creds: StoredCredentials
  try {
    creds = JSON.parse(plain) as StoredCredentials
  } catch {
    return null
  }
  if (!creds.refresh_token) return null

  if (creds.access_token && creds.expires_at && new Date(creds.expires_at) > new Date()) {
    return { accessToken: creds.access_token, rootFolderId }
  }
  const refreshed = await args.oauth.refreshAccessToken(creds.refresh_token)
  const next: StoredCredentials = {
    refresh_token: creds.refresh_token,
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + Math.max(refreshed.expires_in - 60, 0) * 1000).toISOString(),
  }
  integration.update({ credentials_encrypted: await args.encrypt(JSON.stringify(next)), last_sync_at: new Date().toISOString() })
  await args.repo.save(integration)
  return { accessToken: refreshed.access_token, rootFolderId }
}
