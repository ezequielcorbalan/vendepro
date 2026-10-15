import { getOrgDriveAccess } from '@vendepro/core'
import type {
  CloudDocumentStorage,
  CloudFile,
  CloudFolder,
  GoogleOAuthGateway,
  OrgCloudStorageProvider,
  OrgIntegrationRepository,
} from '@vendepro/core'

const FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const TIMEOUT_MS = 30_000
/** Subir 15 MB desde un Worker puede tardar más que un request común. */
const UPLOAD_TIMEOUT_MS = 120_000

/** Comillas simples escapadas para la sintaxis de búsqueda de Drive. */
const q = (v: string) => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`

/**
 * Google Drive de UNA org, con scope `drive.file`: sólo ve lo que creó
 * VendéPro. Las carpetas se encuentran por `appProperties` (etiquetas ocultas),
 * no por nombre: si alguien renombra la carpeta, se sigue encontrando.
 */
export class GoogleDriveStorage implements CloudDocumentStorage {
  constructor(
    private readonly accessToken: string,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async ensureRootFolder(name: string): Promise<CloudFolder> {
    const found = await this.findFolder(`appProperties has { key='vendepro_root' and value='1' }`)
    if (found) return found
    return this.createFolder({ name, appProperties: { vendepro_root: '1' } })
  }

  async ensurePropertyFolder(input: { rootFolderId: string; propertyId: string; name: string }): Promise<CloudFolder> {
    const found = await this.findFolder(
      `appProperties has { key='vendepro_property_id' and value='${q(input.propertyId)}' } and '${q(input.rootFolderId)}' in parents`,
    )
    if (found) return found
    return this.createFolder({
      name: input.name,
      parents: [input.rootFolderId],
      appProperties: { vendepro_property_id: input.propertyId },
    })
  }

  /**
   * Subida reanudable: la "multipart" de Drive corta en 5 MB y el portal acepta
   * hasta 15. Son dos requests: abrir la sesión y mandar los bytes.
   */
  async upload(input: { folderId: string; name: string; mimeType: string; data: Blob }): Promise<CloudFile> {
    const init = await this.fetchFn(`${UPLOAD_URL}?uploadType=resumable&fields=id,webViewLink`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': input.mimeType,
        'X-Upload-Content-Length': String(input.data.size),
      },
      body: JSON.stringify({ name: input.name, parents: [input.folderId] }),
    })
    const location = init.headers.get('location')
    if (!init.ok || !location) throw new Error(`Drive (abrir subida): ${await errorText(init)}`)

    const put = await this.fetchFn(location, {
      method: 'PUT',
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      headers: { 'Content-Type': input.mimeType },
      body: input.data,
    })
    const data = (await put.json().catch(() => ({}))) as any
    if (!put.ok || !data?.id) throw new Error(`Drive (subir): ${data?.error?.message || `HTTP ${put.status}`}`)
    return { id: data.id, url: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view` }
  }

  private async findFolder(condition: string): Promise<CloudFolder | null> {
    const params = new URLSearchParams({
      q: `${condition} and mimeType='${FOLDER_MIME}' and trashed=false`,
      fields: 'files(id,webViewLink)',
      pageSize: '1',
    })
    const res = await this.fetchFn(`${FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const data = (await res.json().catch(() => ({}))) as any
    if (!res.ok) throw new Error(`Drive (buscar carpeta): ${data?.error?.message || `HTTP ${res.status}`}`)
    const file = data.files?.[0]
    return file?.id ? { id: file.id, url: file.webViewLink || folderUrl(file.id) } : null
  }

  private async createFolder(meta: { name: string; parents?: string[]; appProperties: Record<string, string> }): Promise<CloudFolder> {
    const res = await this.fetchFn(`${FILES_URL}?fields=id,webViewLink`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...meta, mimeType: FOLDER_MIME }),
    })
    const data = (await res.json().catch(() => ({}))) as any
    if (!res.ok || !data?.id) throw new Error(`Drive (crear carpeta): ${data?.error?.message || `HTTP ${res.status}`}`)
    return { id: data.id, url: data.webViewLink || folderUrl(data.id) }
  }
}

async function errorText(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as any
  return data?.error?.message || `HTTP ${res.status}`
}

/** Abre el Drive de cada org con su token (refrescándolo si venció). */
export class GoogleDriveOrgStorageProvider implements OrgCloudStorageProvider {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly oauth: GoogleOAuthGateway,
    private readonly encrypt: (plain: string) => Promise<string>,
    private readonly decrypt: (cipher: string) => Promise<string | null>,
  ) {}

  async forOrg(orgId: string) {
    const access = await getOrgDriveAccess({ orgId, repo: this.repo, oauth: this.oauth, encrypt: this.encrypt, decrypt: this.decrypt })
    if (!access) return null
    return { storage: new GoogleDriveStorage(access.accessToken), rootFolderId: access.rootFolderId }
  }
}
