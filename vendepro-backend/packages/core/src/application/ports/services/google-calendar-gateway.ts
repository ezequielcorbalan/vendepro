/** Tokens que devuelve Google al canjear el code o refrescar. */
export interface GoogleTokenSet {
  access_token: string
  /** Sólo viene en el canje inicial (access_type=offline + prompt=consent). */
  refresh_token?: string | null
  /** Segundos de vida del access token. */
  expires_in: number
  /** Email de la cuenta conectada (del id_token). */
  email?: string | null
  /**
   * Scopes que Google concedió realmente, separados por espacio.
   *
   * No siempre son los que se pidieron: la pantalla de consentimiento muestra
   * los permisos con checkboxes independientes, y el usuario puede destildar
   * el de calendario. Sin mirar esto, se guarda un token que no sirve y el
   * error recién aparece al primer uso.
   */
  scope?: string | null
}

/** Scope mínimo sin el cual la integración no puede hacer nada útil. */
export const GOOGLE_CALENDAR_REQUIRED_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export interface GoogleEventPayload {
  summary: string
  description?: string | null
  /** ISO local sin offset (ej: 2026-07-10T15:00:00) — se interpreta con timeZone. */
  startIso: string
  endIso: string
  timeZone: string
  /** Emails de los invitados (el cliente). Google les manda la invitación. */
  attendees: string[]
}

/** Evento tal como lo devuelve Google, ya normalizado. */
export interface GoogleCalendarEvent {
  id: string
  summary: string
  description: string | null
  /** ISO. Para eventos de día completo, Google manda sólo `date`. */
  start: string
  end: string
  all_day: boolean
  html_link: string | null
  /** 'confirmed' | 'tentative' | 'cancelled' */
  status: string | null
}

export interface ListGoogleEventsInput {
  /** Rango a consultar, en ISO. */
  timeMin: string
  timeMax: string
  maxResults?: number
}

/**
 * Gateway a Google (OAuth 2.0 + Calendar API v3). Las operaciones de eventos
 * usan sendUpdates=all: Google notifica por email a los invitados en cada
 * creación/cambio/cancelación — esa es la "agendación automática" al cliente.
 */
export interface GoogleCalendarGateway {
  exchangeCode(code: string, redirectUri: string): Promise<GoogleTokenSet>
  refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }>
  /** Best-effort: revocar al desconectar. No debe tirar si el token ya expiró. */
  revokeToken(token: string): Promise<void>
  /**
   * Eventos del calendario principal del usuario en un rango.
   * Sólo lectura: el scope `calendar.events` ya lo permite, no hace falta
   * re-consentir.
   */
  listEvents(accessToken: string, input: ListGoogleEventsInput): Promise<GoogleCalendarEvent[]>
  createEvent(accessToken: string, event: GoogleEventPayload): Promise<{ id: string }>
  updateEvent(accessToken: string, eventId: string, event: GoogleEventPayload): Promise<void>
  deleteEvent(accessToken: string, eventId: string): Promise<void>
}
