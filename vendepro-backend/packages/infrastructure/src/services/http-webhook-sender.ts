import type { WebhookSender, WebhookSendResult } from '@vendepro/core'

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * POST JSON con firma `X-VendePro-Signature: sha256=HMAC(secret, body)`.
 * El receptor valida recalculando el HMAC del body crudo con el mismo secret.
 */
export class HttpWebhookSender implements WebhookSender {
  constructor(private readonly timeoutMs = 10_000) {}

  async send(url: string, secret: string, body: string): Promise<WebhookSendResult> {
    try {
      const signature = await hmacSha256Hex(secret, body)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VendePro-Signature': `sha256=${signature}`,
          'User-Agent': 'VendePro-Webhooks/1.0',
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      // Consumir el body evita dejar la conexión colgada en Workers.
      await res.text().catch(() => '')
      return { ok: res.ok, status: res.status, error: res.ok ? null : `HTTP ${res.status}` }
    } catch (err) {
      const msg = (err as Error)?.name === 'TimeoutError' ? 'timeout' : ((err as Error)?.message ?? 'network error')
      return { ok: false, status: null, error: msg }
    }
  }
}
