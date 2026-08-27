import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'
import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { GoogleCalendarGateway, GoogleEventPayload } from '../../ports/services/google-calendar-gateway'
import type { UserIntegration } from '../../../domain/entities/user-integration'
import type { CalendarEvent } from '../../../domain/entities/calendar-event'
import type { TokenEncryptor } from '../marketing/save-meta-integration'
import type { TokenDecryptor } from './test-kiteprop-connection'
import { GOOGLE_CALENDAR_PROVIDER } from './get-google-integration'

const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires'
const DEFAULT_DURATION_MS = 60 * 60 * 1000

export interface SyncEventToGoogleInput {
  orgId: string
  /** Agente dueño del evento — se sincroniza contra SU Google Calendar. */
  agentId: string
  action: 'upsert' | 'delete'
  /** Requerido para upsert. */
  eventId?: string
  /** Requerido para delete (el evento local puede ya estar borrado). */
  googleEventId?: string | null
  /** Email del cliente a invitar; si falta se usa el del contacto vinculado. */
  attendeeEmail?: string | null
}

export interface SyncEventToGoogleResult {
  synced: boolean
  /** true si el evento quedó en Google con el cliente como invitado (Google le manda el mail). */
  inviteSent: boolean
  reason?: string
}

interface StoredCredentials {
  refresh_token: string
  access_token?: string
  expires_at?: string
}

const NOT_SYNCED = (reason: string): SyncEventToGoogleResult => ({ synced: false, inviteSent: false, reason })

/**
 * Espeja un evento del CRM en el Google Calendar del agente. Si hay un email
 * de cliente (explícito o del contacto vinculado) y el agente dejó activo
 * `auto_invite`, lo agrega como invitado:
 * con sendUpdates=all Google le envía la invitación por email automáticamente
 * y el evento aparece en el calendario del cliente cuando acepta.
 *
 * Diseñado para llamarse best-effort desde las rutas de calendario: cualquier
 * falla se reporta en el resultado, nunca debe frenar la operación local.
 */
export class SyncEventToGoogleUseCase {
  constructor(
    private readonly integrationRepo: UserIntegrationRepository,
    private readonly calendarRepo: CalendarRepository,
    private readonly contactRepo: ContactRepository,
    private readonly gateway: GoogleCalendarGateway,
    private readonly encryptToken: TokenEncryptor,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: SyncEventToGoogleInput): Promise<SyncEventToGoogleResult> {
    const integration = await this.integrationRepo.findByUserAndProvider(input.agentId, GOOGLE_CALENDAR_PROVIDER)
    if (!integration || !integration.enabled || !integration.credentials_encrypted) {
      return NOT_SYNCED('not_connected')
    }

    const accessToken = await this.getValidAccessToken(integration)
    if (!accessToken) return NOT_SYNCED('invalid_credentials')

    if (input.action === 'delete') {
      if (!input.googleEventId) return NOT_SYNCED('no_google_event')
      await this.gateway.deleteEvent(accessToken, input.googleEventId)
      return { synced: true, inviteSent: false }
    }

    if (!input.eventId) return NOT_SYNCED('no_event')
    const event = await this.calendarRepo.findById(input.eventId, input.orgId)
    if (!event || !event.start_at) return NOT_SYNCED('no_event')

    // El agente puede apagar "invitar al cliente" desde su configuración. Sin
    // este chequeo el evento se creaba igual con el cliente como invitado y
    // Google le mandaba el mail — el setting quedaba decorativo.
    const autoInvite = integration.getConfig().auto_invite !== false
    const attendee = autoInvite
      ? await this.resolveAttendee(input.attendeeEmail, event, input.orgId)
      : null
    const payload = this.buildPayload(event, attendee)

    let googleEventId = event.google_event_id ?? null
    if (googleEventId) {
      await this.gateway.updateEvent(accessToken, googleEventId, payload)
    } else {
      googleEventId = (await this.gateway.createEvent(accessToken, payload)).id
    }

    const inviteSentAt = attendee ? (event.invite_sent_at ?? new Date().toISOString()) : (event.invite_sent_at ?? null)
    await this.calendarRepo.setGoogleMeta(event.id, input.orgId, googleEventId, inviteSentAt)

    return { synced: true, inviteSent: !!attendee }
  }

  private async resolveAttendee(explicit: string | null | undefined, event: CalendarEvent, orgId: string): Promise<string | null> {
    const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
    if (explicit && isEmail(explicit.trim())) return explicit.trim()
    if (event.contact_id) {
      const contact = await this.contactRepo.findById(event.contact_id, orgId)
      if (contact?.email && isEmail(contact.email)) return contact.email
    }
    return null
  }

  private buildPayload(event: CalendarEvent, attendee: string | null): GoogleEventPayload {
    const startIso = normalizeIso(event.start_at as string)
    const endIso = event.end_at ? normalizeIso(event.end_at) : addMs(startIso, DEFAULT_DURATION_MS)
    return {
      summary: event.title,
      description: event.description ?? null,
      startIso,
      endIso,
      timeZone: ARGENTINA_TZ,
      attendees: attendee ? [attendee] : [],
    }
  }

  /** Access token vigente; refresca (y persiste) si expiró. Null si las credenciales no sirven. */
  private async getValidAccessToken(integration: UserIntegration): Promise<string | null> {
    const plain = await this.decryptToken(integration.credentials_encrypted as string)
    if (!plain) return null

    let creds: StoredCredentials
    try {
      creds = JSON.parse(plain) as StoredCredentials
    } catch {
      return null
    }
    if (!creds.refresh_token) return null

    const stillValid = creds.access_token && creds.expires_at && new Date(creds.expires_at) > new Date()
    if (stillValid) return creds.access_token as string

    const refreshed = await this.gateway.refreshAccessToken(creds.refresh_token)
    const next: StoredCredentials = {
      refresh_token: creds.refresh_token,
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + Math.max(refreshed.expires_in - 60, 0) * 1000).toISOString(),
    }
    integration.update({
      credentials_encrypted: await this.encryptToken(JSON.stringify(next)),
      last_sync_at: new Date().toISOString(),
    })
    await this.integrationRepo.save(integration)
    return refreshed.access_token
  }
}

/** '2026-07-10T15:00' (datetime-local) → '2026-07-10T15:00:00'; ISO absolutos quedan como están. */
function normalizeIso(s: string): string {
  const trimmed = s.trim()
  if (/Z$|[+-]\d{2}:\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`
  return trimmed
}

function addMs(iso: string, ms: number): string {
  const absolute = /Z$|[+-]\d{2}:\d{2}$/.test(iso)
  // Los naive se operan como UTC sólo para sumar; se devuelven naive de nuevo.
  const base = new Date(absolute ? iso : `${iso}Z`)
  const shifted = new Date(base.getTime() + ms)
  return absolute ? shifted.toISOString() : shifted.toISOString().slice(0, 19)
}
