import type { DocumentStore, DownloadedFile, DriveItem } from '@vendepro/core'

/**
 * Lectura de la unidad compartida de documentación con una cuenta de servicio.
 *
 * SÓLO LECTURA por diseño: el scope es `drive.readonly` y la cuenta de
 * servicio se agrega a la unidad como *Lector*. Si la clave se filtra, no
 * puede borrar, mover ni renombrar nada. Plan: doc/documentacion-drive-plan.md.
 *
 * El token sale de un JWT RS256 firmado con WebCrypto (grant jwt-bearer), sin
 * librerías: en un Worker no hay `googleapis`.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token'
const FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'

export interface ServiceAccountKey {
  client_email: string
  private_key: string
  token_uri?: string
}

/** Lee el JSON de la clave (tal cual lo descarga Google Cloud). null si no sirve. */
export function parseServiceAccountKey(raw: string | null | undefined): ServiceAccountKey | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.client_email !== 'string' || typeof parsed?.private_key !== 'string') return null
    return { client_email: parsed.client_email, private_key: parsed.private_key, token_uri: parsed.token_uri }
  } catch {
    return null
  }
}

export class GoogleDriveDocumentStore implements DocumentStore {
  private token: { value: string; expiresAt: number } | null = null

  constructor(
    private readonly key: ServiceAccountKey,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async listTree(sharedDriveId: string): Promise<DriveItem[]> {
    const items: DriveItem[] = []
    let pageToken: string | undefined
    // Toda la unidad en 1–3 requests (1000 por página), no una por carpeta.
    do {
      const params = new URLSearchParams({
        corpora: 'drive',
        driveId: sharedDriveId,
        includeItemsFromAllDrives: 'true',
        supportsAllDrives: 'true',
        q: 'trashed = false',
        pageSize: '1000',
        fields: 'nextPageToken, files(id, name, mimeType, parents, size, modifiedTime, webViewLink, description)',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const res = await this.authorized(`${FILES_URL}?${params}`)
      if (!res.ok) throw new Error(`Drive files.list ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
      const data = (await res.json()) as any
      for (const f of data.files ?? []) items.push(toItem(f))
      pageToken = data.nextPageToken || undefined
    } while (pageToken)
    return items
  }

  async download(item: DriveItem, maxBytes: number): Promise<DownloadedFile | null> {
    const isGoogleDoc = item.mimeType === GOOGLE_DOC_MIME
    const mimeType = isGoogleDoc ? 'application/pdf' : normalizeMime(item.mimeType)
    if (mimeType !== 'application/pdf' && !mimeType.startsWith('image/')) return null
    if (item.sizeBytes !== null && item.sizeBytes > maxBytes) return null

    const url = isGoogleDoc
      ? `${FILES_URL}/${encodeURIComponent(item.id)}/export?mimeType=application%2Fpdf`
      : `${FILES_URL}/${encodeURIComponent(item.id)}?alt=media&supportsAllDrives=true`
    const res = await this.authorized(url)
    if (!res.ok) throw new Error(`Drive download ${res.status}`)
    const declared = Number(res.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > maxBytes) return null
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > maxBytes) return null
    return { base64: toBase64(buffer), mimeType }
  }

  private async authorized(url: string): Promise<Response> {
    const token = await this.accessToken()
    return this.fetchFn(url, { headers: { Authorization: `Bearer ${token}` } })
  }

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    if (this.token && this.token.expiresAt - 60 > now) return this.token.value

    const tokenUri = this.key.token_uri || DEFAULT_TOKEN_URI
    const assertion = await signJwt(this.key, {
      iss: this.key.client_email,
      scope: SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
    const res = await this.fetchFn(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    })
    if (!res.ok) {
      throw new Error(`Google token ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
    }
    const data = (await res.json()) as any
    this.token = { value: data.access_token, expiresAt: now + Number(data.expires_in ?? 3600) }
    return this.token.value
  }
}

/** JWT RS256 firmado con WebCrypto a partir de la clave PKCS#8 en PEM. */
export async function signJwt(key: ServiceAccountKey, claims: Record<string, unknown>): Promise<string> {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify(claims))
  const input = `${header}.${payload}`
  const der = pemToDer(key.private_key)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(input))
  return `${input}.${base64UrlBytes(new Uint8Array(signature))}`
}

function toItem(f: any): DriveItem {
  const size = f.size !== undefined ? Number(f.size) : NaN
  return {
    id: f.id,
    name: f.name ?? '',
    mimeType: f.mimeType ?? '',
    parentId: Array.isArray(f.parents) && f.parents.length > 0 ? f.parents[0] : null,
    isFolder: f.mimeType === FOLDER_MIME,
    sizeBytes: Number.isFinite(size) ? size : null,
    modifiedTime: f.modifiedTime ?? '',
    webViewLink: f.webViewLink ?? null,
    description: f.description ?? null,
  }
}

function normalizeMime(mime: string): string {
  const m = (mime || '').toLowerCase()
  return m === 'image/jpg' ? 'image/jpeg' : m
}

function pemToDer(pem: string): ArrayBuffer {
  // La clave del JSON viene con "\n" literales si se pegó escapada.
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function base64Url(text: string): string {
  return base64UrlBytes(new TextEncoder().encode(text))
}

function base64UrlBytes(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function toBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer))
}

/** En trozos: String.fromCharCode(...bytes) revienta el stack con un PDF de varios MB. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
