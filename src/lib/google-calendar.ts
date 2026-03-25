// Google Calendar OAuth + API helpers
// Env vars needed: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'

export function getRedirectUri() {
  // In production use the worker URL, in dev use localhost
  const base = process.env.NODE_ENV === 'production'
    ? 'https://reportes-mg.marcelagenta.workers.dev'
    : 'http://localhost:3000'
  return `${base}/api/auth/google/callback`
}

export function getAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || ''
  const redirectUri = getRedirectUri()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCode(code: string): Promise<{
  access_token: string; refresh_token: string; expires_in: number
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }
  return (await res.json()) as any
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string; expires_in: number
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Refresh failed')
  return (await res.json()) as any
}

export async function getGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json()) as any
  return data.email || ''
}

// ── Event classification ──────────────────────────────────
const TYPE_KEYWORDS: Record<string, string[]> = {
  llamada:          ['llamada', 'call', 'telefon'],
  reunion:          ['reunión', 'reunion', 'meeting', 'meet'],
  visita_captacion: ['visita', 'recorrida', 'showing'],
  tasacion:         ['tasación', 'tasacion', 'valuación', 'valuacion'],
  seguimiento:      ['seguimiento', 'follow', 'follow-up', 'followup'],
  firma:            ['firma', 'signing', 'escritura', 'boleto'],
  presentacion:     ['presentación', 'presentacion', 'propuesta'],
  admin:            ['admin', 'tramite', 'trámite', 'documentación'],
}

export function classifyEvent(title: string): string {
  const lower = title.toLowerCase()
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return type
  }
  return 'otro'
}

// ── Fetch Google Calendar events ──────────────────────────
export async function fetchGoogleEvents(accessToken: string, timeMin: string, timeMax: string): Promise<any[]> {
  const params = new URLSearchParams({
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  })
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED')
    throw new Error(`Google API error: ${res.status}`)
  }
  const data = (await res.json()) as any
  return (data.items || []).map((item: any) => ({
    google_id: item.id,
    title: item.summary || '(Sin título)',
    description: item.description || '',
    start_at: item.start?.dateTime || item.start?.date || '',
    end_at: item.end?.dateTime || item.end?.date || '',
    all_day: !item.start?.dateTime,
    location: item.location || '',
    event_type: classifyEvent(item.summary || ''),
    source: 'google',
    html_link: item.htmlLink || '',
    attendees: (item.attendees || []).map((a: any) => a.email),
  }))
}

// ── Create event in Google Calendar ───────────────────────
export async function createGoogleEvent(accessToken: string, event: {
  title: string; description?: string; start_at: string; end_at: string; location?: string
}): Promise<string> {
  const body: any = {
    summary: event.title,
    description: event.description || '',
    start: { dateTime: new Date(event.start_at).toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
    end: { dateTime: new Date(event.end_at).toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
  }
  if (event.location) body.location = event.location

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Create event failed: ${res.status}`)
  const data = (await res.json()) as any
  return data.id
}
