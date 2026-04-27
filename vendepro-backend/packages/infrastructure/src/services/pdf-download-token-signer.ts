import type { PdfDownloadTokenSigner, PdfDownloadTokenPayload } from '@vendepro/core'

interface Opts {
  secret: string
  apiPublicBaseUrl: string
}

export class PdfDownloadTokenSignerImpl implements PdfDownloadTokenSigner {
  constructor(private readonly opts: Opts) {}

  async buildDownloadUrl(input: { r2Key: string; orgId: string; appraisalId: string; filename: string; ttlSec: number }): Promise<string> {
    const expSec = Math.floor(Date.now() / 1000) + input.ttlSec
    const token = await signHs256(this.opts.secret, {
      r2Key: input.r2Key,
      orgId: input.orgId,
      appraisalId: input.appraisalId,
      exp: expSec,
    })
    const path = `/public/pdf/${encodeURIComponent(input.orgId)}/${encodeURIComponent(input.appraisalId)}/${encodeURIComponent(input.filename)}`
    return `${this.opts.apiPublicBaseUrl}${path}?token=${encodeURIComponent(token)}`
  }

  async verify(token: string): Promise<PdfDownloadTokenPayload | null> {
    const payload = await verifyHs256(this.opts.secret, token)
    if (!payload) return null
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null
    if (typeof payload.r2Key !== 'string' || typeof payload.orgId !== 'string' || typeof payload.appraisalId !== 'string') return null
    return { r2Key: payload.r2Key, orgId: payload.orgId, appraisalId: payload.appraisalId }
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacSha256(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, data)
  return new Uint8Array(sig)
}

async function signHs256(secret: string, payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const signingInput = `${encHeader}.${encPayload}`
  const sigBytes = await hmacSha256(secret, new TextEncoder().encode(signingInput))
  return `${signingInput}.${base64UrlEncode(sigBytes)}`
}

async function verifyHs256(secret: string, token: string): Promise<Record<string, any> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const encHeader = parts[0]!
  const encPayload = parts[1]!
  const encSig = parts[2]!
  const signingInput = `${encHeader}.${encPayload}`
  const expected = await hmacSha256(secret, new TextEncoder().encode(signingInput))
  const actual = base64UrlDecode(encSig)
  if (expected.length !== actual.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i]! ^ actual[i]!
  if (diff !== 0) return null
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(encPayload)))
  } catch {
    return null
  }
}
