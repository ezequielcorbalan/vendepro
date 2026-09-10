import type {
  GoogleCalendarGateway, GoogleTokenSet, GoogleEventPayload,
  GoogleCalendarEvent, ListGoogleEventsInput,
  GoogleWatchChannel, WatchEventsInput, GoogleChangesPage, ListChangesInput,
} from '@vendepro/core'

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

/** Scopes mínimos: gestionar eventos + identificar la cuenta conectada. */
export const GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.events openid email'

/**
 * URL de consentimiento OAuth. access_type=offline + prompt=consent fuerzan
 * que Google devuelva refresh_token en cada conexión.
 */
export function buildGoogleAuthUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: input.state,
  })
  return `${OAUTH_AUTH_URL}?${params.toString()}`
}

export class GoogleCalendarHttpClient implements GoogleCalendarGateway {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly timeoutMs = 15_000,
  ) {}

  async exchangeCode(code: string, redirectUri: string): Promise<GoogleTokenSet> {
    const data = await this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_in: data.expires_in ?? 3600,
      email: decodeIdTokenEmail(data.id_token),
      scope: typeof data.scope === 'string' ? data.scope : null,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    const data = await this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await fetch(`${OAUTH_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      // best-effort: un token ya vencido/revocado no debe frenar la desconexión
    }
  }

  async listEvents(accessToken: string, input: ListGoogleEventsInput): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      // Expande los recurrentes en instancias concretas: si no, una reunión
      // semanal llega como una sola fila con regla de repetición.
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(Math.min(input.maxResults ?? 250, 2500)),
    })
    const res = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    const data = (await res.json().catch(() => ({}))) as any
    if (!res.ok) {
      throw new Error(`Google Calendar: ${data?.error?.message || `HTTP ${res.status}`}`)
    }
    return (Array.isArray(data.items) ? data.items : [])
      .filter((item: any) => item?.id && item?.status !== 'cancelled')
      .map(toGoogleCalendarEvent)
  }

  async createEvent(accessToken: string, event: GoogleEventPayload): Promise<{ id: string }> {
    const data = await this.calendarRequest(accessToken, 'POST', `${CALENDAR_EVENTS_URL}?sendUpdates=all`, toGoogleBody(event))
    if (!data?.id) throw new Error('Google Calendar: la creación no devolvió id')
    return { id: data.id }
  }

  async updateEvent(accessToken: string, eventId: string, event: GoogleEventPayload): Promise<void> {
    await this.calendarRequest(
      accessToken,
      'PATCH',
      `${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`,
      toGoogleBody(event),
    )
  }

  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const res = await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    // 404/410: ya no existe en Google (borrado a mano) — objetivo cumplido
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Google Calendar: HTTP ${res.status} al borrar el evento`)
    }
  }

  async watchEvents(accessToken: string, input: WatchEventsInput): Promise<GoogleWatchChannel> {
    const res = await fetch(`${CALENDAR_EVENTS_URL}/watch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: input.channelId,
        type: 'web_hook',
        address: input.address,
        // Google devuelve este token en cada notificación: es lo que prueba
        // que el POST viene de Google y no de cualquiera que sepa la URL.
        token: input.token,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    const data = (await res.json().catch(() => ({}))) as any
    if (!res.ok) {
      throw new Error(`Google Calendar: ${data?.error?.message || `HTTP ${res.status}`} al abrir el canal`)
    }
    return {
      id: typeof data.id === 'string' ? data.id : input.channelId,
      resource_id: typeof data.resourceId === 'string' ? data.resourceId : '',
      // Google lo manda como string de ms epoch.
      expiration: data.expiration ? Number(data.expiration) : null,
    }
  }

  async stopChannel(accessToken: string, channelId: string, resourceId: string): Promise<void> {
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: channelId, resourceId }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      // 404: el canal ya venció o se cerró — objetivo cumplido.
      if (!res.ok && res.status !== 404) {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch {
      // Best-effort a propósito: si no se puede cerrar, el canal vence solo.
      // Fallar acá bloquearía la desconexión de la cuenta, que es lo que el
      // usuario realmente pidió.
    }
  }

  async listChanges(accessToken: string, input: ListChangesInput): Promise<GoogleChangesPage> {
    const params = new URLSearchParams({
      singleEvents: 'true',
      maxResults: '250',
      // Sin esto los cancelados no vienen, y en una sincronización incremental
      // "cancelado" ES el cambio que hay que aplicar.
      showDeleted: 'true',
    })
    if (input.syncToken) {
      params.set('syncToken', input.syncToken)
    } else {
      // Primera sincronización: se acota por ventana. `syncToken` y los
      // filtros de tiempo son mutuamente excluyentes en la API de Google.
      if (input.timeMin) params.set('timeMin', input.timeMin)
      if (input.timeMax) params.set('timeMax', input.timeMax)
    }

    const res = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    // 410 GONE: el token caducó (pasó demasiado tiempo). No es un error a
    // propagar: es la señal de "resincronizá todo y empezá un token nuevo".
    if (res.status === 410) {
      return { events: [], next_sync_token: null, sync_token_expired: true }
    }

    const data = (await res.json().catch(() => ({}))) as any
    if (!res.ok) {
      throw new Error(`Google Calendar: ${data?.error?.message || `HTTP ${res.status}`}`)
    }
    return {
      events: (Array.isArray(data.items) ? data.items : [])
        .filter((item: any) => item?.id)
        .map(toGoogleCalendarEvent),
      next_sync_token: typeof data.nextSyncToken === 'string' ? data.nextSyncToken : null,
      sync_token_expired: false,
    }
  }

  private async tokenRequest(params: Record<string, string>): Promise<any> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      ...params,
    })
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    const data = (await res.json().catch(() => ({}))) as any
    if (!res.ok || !data.access_token) {
      throw new Error(`Google OAuth: ${data.error_description || data.error || `HTTP ${res.status}`}`)
    }
    return data
  }

  private async calendarRequest(accessToken: string, method: string, url: string, body: unknown): Promise<any> {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    const data = (await res.json().catch(() => ({}))) as any
    if (!res.ok) {
      throw new Error(`Google Calendar: ${data?.error?.message || `HTTP ${res.status}`}`)
    }
    return data
  }
}

/**
 * Google manda `dateTime` (con zona) para eventos con hora y `date` para los de
 * día completo. Se normaliza a un solo shape para que el resto no tenga que
 * distinguir.
 */
function toGoogleCalendarEvent(item: any): GoogleCalendarEvent {
  const allDay = !item?.start?.dateTime
  return {
    id: String(item.id),
    summary: typeof item.summary === 'string' && item.summary.trim() ? item.summary : '(sin título)',
    description: typeof item.description === 'string' ? item.description : null,
    start: item?.start?.dateTime ?? item?.start?.date ?? '',
    end: item?.end?.dateTime ?? item?.end?.date ?? '',
    all_day: allDay,
    html_link: typeof item.htmlLink === 'string' ? item.htmlLink : null,
    status: typeof item.status === 'string' ? item.status : null,
  }
}

function toGoogleBody(event: GoogleEventPayload) {
  return {
    summary: event.summary,
    description: event.description ?? undefined,
    start: { dateTime: event.startIso, timeZone: event.timeZone },
    end: { dateTime: event.endIso, timeZone: event.timeZone },
    attendees: event.attendees.map(email => ({ email })),
    reminders: { useDefault: true },
  }
}

/** Email del id_token (JWT de Google). No validamos firma: viene directo de Google por TLS. */
function decodeIdTokenEmail(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null
  const segments = idToken.split('.')
  if (segments.length < 2 || !segments[1]) return null
  try {
    const b64 = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')))
    return typeof json.email === 'string' ? json.email : null
  } catch {
    return null
  }
}
