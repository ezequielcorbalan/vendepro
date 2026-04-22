import type {
  MetaConversionAPI,
  SendMetaEventInput,
  SendMetaEventResult,
} from '@vendepro/core'

/**
 * HTTP adapter para Meta Conversion API.
 *
 * Endpoint:
 *   ${endpoint}/v17.0/${pixelId}/events?access_token=${token}[&test_event_code=...]
 *
 * Default endpoint: https://graph.facebook.com
 * Stape (server-side GTM) puede sobrescribirlo.
 */
export class MetaConversionAPIHttp implements MetaConversionAPI {
  async sendEvent(input: SendMetaEventInput): Promise<SendMetaEventResult> {
    const endpoint = (input.endpoint && input.endpoint.trim().length > 0)
      ? input.endpoint.replace(/\/+$/, '')
      : 'https://graph.facebook.com'

    if (!input.pixelId) return { ok: false, status: 0, body: '', error: 'pixelId is required' }
    if (!input.accessToken) return { ok: false, status: 0, body: '', error: 'accessToken is required' }

    const url = new URL(`${endpoint}/v17.0/${input.pixelId}/events`)
    url.searchParams.set('access_token', input.accessToken)
    if (input.testEventCode) url.searchParams.set('test_event_code', input.testEventCode)

    const body: Record<string, unknown> = {
      data: [input.payload],
    }
    if (input.testEventCode) {
      body.test_event_code = input.testEventCode
    }

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      return {
        ok: res.ok,
        status: res.status,
        body: text,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      }
    } catch (err: any) {
      return {
        ok: false,
        status: 0,
        body: '',
        error: err?.message ?? 'network error',
      }
    }
  }
}
