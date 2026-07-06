/** Tokens que devuelve Google al canjear el code o refrescar. */
export interface GoogleTokenSet {
  access_token: string
  /** Sólo viene en el canje inicial (access_type=offline + prompt=consent). */
  refresh_token?: string | null
  /** Segundos de vida del access token. */
  expires_in: number
  /** Email de la cuenta conectada (del id_token). */
  email?: string | null
}

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
  createEvent(accessToken: string, event: GoogleEventPayload): Promise<{ id: string }>
  updateEvent(accessToken: string, eventId: string, event: GoogleEventPayload): Promise<void>
  deleteEvent(accessToken: string, eventId: string): Promise<void>
}
