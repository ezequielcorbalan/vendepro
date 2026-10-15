import { describe, it, expect, vi, beforeAll } from 'vitest'
import { GoogleDriveDocumentStore, parseServiceAccountKey, signJwt } from '../../src/services/google-drive-document-store'
import type { ServiceAccountKey } from '../../src/services/google-drive-document-store'

let key: ServiceAccountKey
let publicKey: CryptoKey

/** Clave RSA generada para el test: ninguna credencial real. */
beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } as any,
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer)
  const b64 = btoa(String.fromCharCode(...Array.from(pkcs8))).replace(/(.{64})/g, '$1\n')
  key = { client_email: 'lector@proyecto.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n` }
  publicKey = pair.publicKey
})

const b64urlDecode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })
}

describe('parseServiceAccountKey', () => {
  it('acepta el JSON de Google y rechaza lo que no sirve', () => {
    expect(parseServiceAccountKey('{"client_email":"a@b","private_key":"x","token_uri":"https://t"}')).toEqual({
      client_email: 'a@b', private_key: 'x', token_uri: 'https://t',
    })
    expect(parseServiceAccountKey('{"client_email":"a@b"}')).toBeNull()
    expect(parseServiceAccountKey('no json')).toBeNull()
    expect(parseServiceAccountKey(undefined)).toBeNull()
  })
})

describe('signJwt', () => {
  it('firma un JWT RS256 verificable con la clave pública', async () => {
    const jwt = await signJwt(key, { iss: key.client_email, scope: 's', aud: 'a', iat: 1, exp: 2 })
    const [h, p, s] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h!)))).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(p!)))).toMatchObject({ iss: key.client_email, scope: 's' })
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, b64urlDecode(s!), new TextEncoder().encode(`${h}.${p}`))
    expect(ok).toBe(true)
  })

  it('tolera la clave con "\\n" escapados (pegada en un secret)', async () => {
    const escaped = { ...key, private_key: key.private_key.replace(/\n/g, '\\n') }
    await expect(signJwt(escaped, { a: 1 })).resolves.toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
  })
})

describe('GoogleDriveDocumentStore', () => {
  it('pide el token con scope de sólo lectura y lista la unidad paginando', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        const assertion = new URLSearchParams(String(init?.body)).get('assertion')!
        const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(assertion.split('.')[1]!)))
        expect(claims.scope).toBe('https://www.googleapis.com/auth/drive.readonly')
        return json({ access_token: 'tok', expires_in: 3600 })
      }
      const params = new URL(url).searchParams
      expect(params.get('driveId')).toBe('0Adrive')
      expect(params.get('supportsAllDrives')).toBe('true')
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
      if (!params.get('pageToken')) {
        return json({
          nextPageToken: 'p2',
          files: [{ id: 'f1', name: 'Calle 1', mimeType: 'application/vnd.google-apps.folder', parents: ['0Adrive'], modifiedTime: 't' }],
        })
      }
      return json({ files: [{ id: 'a', name: 'a.pdf', mimeType: 'application/pdf', parents: ['f1'], size: '1234', modifiedTime: 't', webViewLink: 'w' }] })
    })
    const store = new GoogleDriveDocumentStore(key, fetchFn as any)
    const items = await store.listTree('0Adrive')

    expect(items).toEqual([
      expect.objectContaining({ id: 'f1', isFolder: true, parentId: '0Adrive', sizeBytes: null }),
      expect.objectContaining({ id: 'a', isFolder: false, parentId: 'f1', sizeBytes: 1234, webViewLink: 'w' }),
    ])
    // Un solo token para las dos páginas.
    expect(fetchFn.mock.calls.filter(([u]) => String(u).includes('oauth2')).length).toBe(1)
  })

  it('descarga el contenido; los Google Docs se exportan a PDF', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('oauth2')) return json({ access_token: 'tok', expires_in: 3600 })
      if (url.includes('/export?')) return new Response(new Uint8Array([1, 2, 3]))
      return new Response(new Uint8Array([104, 111, 108, 97]))
    })
    const store = new GoogleDriveDocumentStore(key, fetchFn as any)
    const base = { name: 'x', parentId: 'f', isFolder: false, modifiedTime: 't', webViewLink: null, description: null }

    const pdf = await store.download({ ...base, id: 'a', mimeType: 'application/pdf', sizeBytes: 4 }, 100)
    expect(pdf?.mimeType).toBe('application/pdf')
    expect(await pdf!.data.text()).toBe('hola')
    const doc = await store.download({ ...base, id: 'g', mimeType: 'application/vnd.google-apps.document', sizeBytes: null }, 100)
    expect(doc?.mimeType).toBe('application/pdf')
    expect(Array.from(new Uint8Array(await doc!.data.arrayBuffer()))).toEqual([1, 2, 3])
  })

  it('no descarga lo que pesa de más ni lo que no se lee', async () => {
    const fetchFn = vi.fn(async () => json({ access_token: 'tok', expires_in: 3600 }))
    const store = new GoogleDriveDocumentStore(key, fetchFn as any)
    const base = { id: 'a', name: 'x', parentId: 'f', isFolder: false, modifiedTime: 't', webViewLink: null, description: null }

    await expect(store.download({ ...base, mimeType: 'application/pdf', sizeBytes: 500 }, 100)).resolves.toBeNull()
    await expect(store.download({ ...base, mimeType: 'application/zip', sizeBytes: 10 }, 100)).resolves.toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('un error de Drive se propaga (el barrido lo aísla por org)', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('oauth2') ? json({ access_token: 'tok', expires_in: 3600 }) : new Response('not found', { status: 404 }))
    const store = new GoogleDriveDocumentStore(key, fetchFn as any)
    await expect(store.listTree('0Ainexistente')).rejects.toThrow(/404/)
  })
})
