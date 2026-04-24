import type {
  Ga4MeasurementProtocol,
  SendGa4EventInput,
  SendGa4EventResult,
} from '@vendepro/core'

/**
 * HTTP adapter para GA4 Measurement Protocol.
 *
 * Endpoint:
 *   ${endpoint}/mp/collect?measurement_id=X&api_secret=Y
 *
 * - Default: https://www.google-analytics.com
 * - Stape (sGTM custom domain) sobrescribe el dominio — permite fan-out
 *   desde el contenedor server-side a GA4, Meta CAPI, TikTok, etc.
 */
export class Ga4MeasurementProtocolHttp implements Ga4MeasurementProtocol {
  async sendEvent(input: SendGa4EventInput): Promise<SendGa4EventResult> {
    const endpoint = (input.endpoint && input.endpoint.trim().length > 0)
      ? input.endpoint.replace(/\/+$/, '')
      : 'https://www.google-analytics.com'

    if (!input.measurementId) return { ok: false, status: 0, body: '', error: 'measurementId is required' }
    if (!input.apiSecret) return { ok: false, status: 0, body: '', error: 'apiSecret is required' }
    if (!input.clientId) return { ok: false, status: 0, body: '', error: 'clientId is required' }
    if (!input.events || input.events.length === 0) {
      return { ok: false, status: 0, body: '', error: 'events is required' }
    }

    const path = input.debug ? '/debug/mp/collect' : '/mp/collect'
    const url = new URL(`${endpoint}${path}`)
    url.searchParams.set('measurement_id', input.measurementId)
    url.searchParams.set('api_secret', input.apiSecret)

    const body: Record<string, unknown> = {
      client_id: input.clientId,
      events: input.events,
    }
    if (input.userId) body.user_id = input.userId
    if (input.userProperties) body.user_properties = input.userProperties

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      // GA4 MP responde 2xx con body vacío en caso de éxito (no debug).
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
