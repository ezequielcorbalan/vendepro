/**
 * GA4 Measurement Protocol service port.
 *
 * POST a:
 *   ${endpoint}/mp/collect?measurement_id=G-XXXX&api_secret=YYY
 *
 * endpoint default: https://www.google-analytics.com
 * Stape (server-side GTM) puede sobrescribirlo vía custom domain
 * (ej. https://sss.midominio.com), lo que mantiene el tracking first-party
 * y permite fan-out a GA4/Meta/TikTok desde el contenedor sGTM.
 *
 * Reference: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

export interface Ga4EventParams {
  // valores recomendados
  currency?: string
  value?: number
  /** SHA-256 hex lowercase — para Enhanced Conversions */
  email_sha256?: string
  phone_sha256?: string
  /** event_id compartido con Pixel client-side (deduplicación) */
  event_id?: string
  [key: string]: unknown
}

export interface Ga4Event {
  name: string
  params?: Ga4EventParams
}

export interface Ga4UserProperties {
  [key: string]: { value: string | number | boolean }
}

export interface SendGa4EventInput {
  measurementId: string
  apiSecret: string
  /** Endpoint base — Stape custom domain o www.google-analytics.com */
  endpoint: string
  /** ID estable por visitante — usar visitor_id/external_id/lead_id hasheado */
  clientId: string
  userId?: string
  events: Ga4Event[]
  userProperties?: Ga4UserProperties
  /** Si true, usa /debug/mp/collect (no envía a GA, valida payload) */
  debug?: boolean
}

export interface SendGa4EventResult {
  ok: boolean
  status: number
  body: string
  error?: string
}

export interface Ga4MeasurementProtocol {
  sendEvent(input: SendGa4EventInput): Promise<SendGa4EventResult>
}
