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
  /** Abre un canal para que Google avise cuando el calendario cambia. */
  watchEvents(accessToken: string, input: WatchEventsInput): Promise<GoogleWatchChannel>
  /** Cierra el canal. Best-effort: no debe tirar si ya venció. */
  stopChannel(accessToken: string, channelId: string, resourceId: string): Promise<void>
  /** Cambios desde el último `syncToken` (o la ventana entera si no hay). */
  listChanges(accessToken: string, input: ListChangesInput): Promise<GoogleChangesPage>
}

// ── Notificaciones push (canales de Google) ───────────────────

/** Canal de notificaciones abierto contra el calendario del usuario. */
export interface GoogleWatchChannel {
  /** Id que elegimos nosotros; Google lo devuelve en cada notificación. */
  id: string
  /** Id del recurso observado. Hace falta para cerrar el canal. */
  resource_id: string
  /** Vencimiento en ms epoch. Google no mantiene canales abiertos para siempre. */
  expiration: number | null
}

export interface WatchEventsInput {
  channelId: string
  /** URL pública HTTPS a la que Google va a postear. */
  address: string
  /** Secreto que Google devuelve en cada notificación — así se valida el origen. */
  token: string
}

/**
 * Una tanda de cambios del calendario.
 *
 * A diferencia de `listEvents`, incluye los eventos cancelados: en una
 * sincronización incremental "cancelado" ES el cambio que hay que aplicar.
 */
export interface GoogleChangesPage {
  events: GoogleCalendarEvent[]
  /** Token para pedir sólo lo que cambie de acá en adelante. */
  next_sync_token: string | null
  /**
   * Google invalidó el token (410). El llamador tiene que resincronizar la
   * ventana entera y arrancar un token nuevo.
   */
  sync_token_expired: boolean
}

export interface ListChangesInput {
  /** Sin token: primera sincronización, acotada por la ventana. */
  syncToken?: string | null
  timeMin?: string
  timeMax?: string
}
