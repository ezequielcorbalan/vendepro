/**
 * Meta Conversion API service port.
 *
 * Standard payload sent to: `${endpoint}/v17.0/${pixelId}/events?access_token=${token}`
 * - endpoint default: https://graph.facebook.com (override por Stape, server-side GTM)
 * - user_data fields (em, ph, fn, ln) deben venir SHA-256 hex lowercase trimmed
 */

export interface MetaUserData {
  em?: string[]
  ph?: string[]
  fn?: string[]
  ln?: string[]
  external_id?: string[]
  client_user_agent?: string
  client_ip_address?: string
}

export interface MetaCustomData {
  currency?: string
  value?: number
  content_name?: string
  content_category?: string
  [key: string]: unknown
}

export interface MetaEventPayload {
  event_name: string
  event_time: number // unix seconds
  event_id: string
  action_source: 'website' | 'app' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other'
  event_source_url?: string
  user_data: MetaUserData
  custom_data?: MetaCustomData
}

export interface SendMetaEventInput {
  pixelId: string
  accessToken: string
  /** Endpoint base — usar Stape o https://graph.facebook.com */
  endpoint: string
  payload: MetaEventPayload
  testEventCode?: string | null
}

export interface SendMetaEventResult {
  ok: boolean
  status: number
  body: string
  error?: string
}

export interface MetaConversionAPI {
  sendEvent(input: SendMetaEventInput): Promise<SendMetaEventResult>
}
