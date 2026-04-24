// Helper client-side para push al dataLayer de GTM con dedupe server/client.
// El `event_id` viene del backend (determinístico por org+entidad+evento+día)
// y se comparte con el Pixel cliente para que Meta/GA4 dedupen.

export interface MarketingEventPayload {
  event_id: string
  event_name: string
  entity_type?: string | null
  entity_id?: string | null
  params?: Record<string, any>
}

export interface MarketingApiResult {
  event_id: string
  meta?: { status: string; event_name?: string; http_status?: number; log_id?: string; reason?: string; body?: string }
  ga4?: { status: string; event_name?: string; http_status?: number; log_id?: string; reason?: string; body?: string }
}

declare global {
  interface Window {
    dataLayer?: any[]
  }
}

export function pushMarketingEvent(p: MarketingEventPayload): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event: 'marketing_event',
    event_id: p.event_id,
    event_name: p.event_name,
    entity_type: p.entity_type ?? null,
    entity_id: p.entity_id ?? null,
    ...(p.params || {}),
  })
}

/**
 * Extrae el event_id + event_name de la respuesta del backend. Prefiere el
 * nombre del provider Meta (estándar) pero cae a GA4 si Meta no corrió.
 */
export function pushFromApiResponse(
  body: any,
  fallback: { entity_type?: string | null; entity_id?: string | null; event_name_fallback?: string } = {},
): void {
  const m: MarketingApiResult | undefined = body?.marketing
  if (!m?.event_id) return
  const eventName =
    m.meta?.event_name ||
    m.ga4?.event_name ||
    fallback.event_name_fallback ||
    'marketing_event'
  pushMarketingEvent({
    event_id: m.event_id,
    event_name: eventName,
    entity_type: fallback.entity_type ?? null,
    entity_id: fallback.entity_id ?? null,
  })
}
