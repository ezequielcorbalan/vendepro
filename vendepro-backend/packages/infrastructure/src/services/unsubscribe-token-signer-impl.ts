import type { UnsubscribeTokenSigner, UnsubscribeTokenPayload } from '@vendepro/core'

/**
 * Firma HS256 compacta para links de baja: base64url(payload).base64url(hmac).
 * Sin expiración: un link de unsubscribe debe funcionar siempre.
 * El secreto es el mismo JWT_SECRET de la plataforma (no viaja al cliente).
 */
export class HmacUnsubscribeTokenSigner implements UnsubscribeTokenSigner {
  constructor(private readonly secret: string) {}

  async sign(payload: UnsubscribeTokenPayload): Promise<string> {
    const email = payload.email.trim().toLowerCase()
    const encPayload = base64UrlEncode(
      new TextEncoder().encode(JSON.stringify({ o: payload.orgId, e: email })),
    )
    const sig = await hmacSha256(this.secret, new TextEncoder().encode(encPayload))
    return `${encPayload}.${base64UrlEncode(sig)}`
  }

  async verify(token: string): Promise<UnsubscribeTokenPayload | null> {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const encPayload = parts[0]!
    const expected = await hmacSha256(this.secret, new TextEncoder().encode(encPayload))
    let actual: Uint8Array
    try {
      actual = base64UrlDecode(parts[1]!)
    } catch {
      return null
    }
    if (!timingSafeEqual(expected, actual)) return null
    try {
      const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encPayload)))
      if (typeof payload?.o !== 'string' || typeof payload?.e !== 'string') return null
      return { orgId: payload.o, email: payload.e }
    } catch {
      return null
    }
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
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
