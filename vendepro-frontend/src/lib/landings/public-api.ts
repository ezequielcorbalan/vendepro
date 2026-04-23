// API client para landings públicas. NO usa apiFetch (que inyecta auth) — va raw contra api-public.

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

export interface PublicLandingView {
  id: string
  full_slug: string
  kind: 'lead_capture' | 'property'
  blocks: any[]     // Block[] — reusa types/types.ts si importás
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_at: string
}

export async function getPublicLanding(slug: string): Promise<PublicLandingView | null> {
  const res = await fetch(`${PUBLIC_BASE}/l/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`api-public ${res.status}`)
  const { landing } = (await res.json()) as any
  return landing
}

export interface SubmitInput {
  name: string
  phone: string
  email?: string | null
  address?: string | null
  message?: string | null
  visitorId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null }
}

export interface MarketingApiResult {
  event_id: string
  meta?: { status: string; event_name?: string; http_status?: number }
  ga4?: { status: string; event_name?: string; http_status?: number }
}

export interface SubmitLandingResponse {
  leadId: string
  successMessage: string
  marketing?: MarketingApiResult | null
}

export async function submitLandingForm(slug: string, input: SubmitInput): Promise<SubmitLandingResponse> {
  const res = await fetch(`${PUBLIC_BASE}/l/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`submit ${res.status}: ${await res.text()}`)
  return (await res.json()) as SubmitLandingResponse
}

export interface RecordEventResponse {
  marketing?: MarketingApiResult | null
}

export async function recordLandingEvent(slug: string, event: {
  type: 'pageview' | 'cta_click' | 'form_start' | 'form_submit'
  visitorId?: string | null
  sessionId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null }
}): Promise<RecordEventResponse | void> {
  try {
    const res = await fetch(`${PUBLIC_BASE}/l/${encodeURIComponent(slug)}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,            // permite que salga en beforeunload
    })
    if (!res.ok || res.status === 204) return
    return (await res.json().catch(() => ({}))) as RecordEventResponse
  } catch { return }
}
