import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'
import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { GoogleCalendarGateway, GoogleCalendarEvent } from '../../ports/services/google-calendar-gateway'
import type { TokenEncryptor } from '../marketing/save-meta-integration'
import type { TokenDecryptor } from './test-kiteprop-connection'
import { GOOGLE_CALENDAR_PROVIDER } from './get-google-integration'
import { getValidGoogleAccessToken } from './google-access-token'

export interface ListGoogleCalendarEventsInput {
  orgId: string
  /** Dueño del calendario: siempre el usuario logueado, nunca otro agente. */
  userId: string
  /** Rango a mostrar, en ISO. */
  start: string
  end: string
}

export interface ListGoogleCalendarEventsOutput {
  events: GoogleCalendarEvent[]
  /** false cuando el agente no conectó su cuenta — el UI lo distingue de "no hay eventos". */
  connected: boolean
  /**
   * Cuenta de Google de la que salen los eventos.
   *
   * Se devuelve acá y no en una segunda request porque es parte de la
   * respuesta a "¿por qué no veo mis eventos?": lo más común es haber
   * conectado la cuenta personal en vez de la de trabajo, y sin mostrar cuál
   * es no hay forma de darse cuenta.
   */
  email?: string | null
  /** Motivo por el que no se pudo traer nada, si aplica. */
  reason?: string
}

const NOT_CONNECTED = (reason: string): ListGoogleCalendarEventsOutput => ({
  events: [],
  connected: false,
  reason,
})

/**
 * Trae los eventos del Google Calendar personal del agente para mostrarlos
 * junto a los del CRM.
 *
 * Sólo lectura, y sólo del calendario propio: el `userId` sale del token, así
 * que nadie puede pedir la agenda de otro.
 *
 * Los eventos que VendéPro ya espejó en Google se filtran: si no, cada visita
 * agendada en el CRM aparecería dos veces —una como evento propio y otra como
 * evento de Google— y el calendario se volvería ilegible.
 */
export class ListGoogleCalendarEventsUseCase {
  constructor(
    private readonly integrationRepo: UserIntegrationRepository,
    private readonly calendarRepo: CalendarRepository,
    private readonly gateway: GoogleCalendarGateway,
    private readonly encryptToken: TokenEncryptor,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: ListGoogleCalendarEventsInput): Promise<ListGoogleCalendarEventsOutput> {
    const integration = await this.integrationRepo.findByUserAndProvider(
      input.userId,
      GOOGLE_CALENDAR_PROVIDER,
    )
    if (!integration || !integration.enabled || !integration.credentials_encrypted) {
      return NOT_CONNECTED('not_connected')
    }

    const accessToken = await getValidGoogleAccessToken({
      integration,
      repo: this.integrationRepo,
      gateway: this.gateway,
      encryptToken: this.encryptToken,
      decryptToken: this.decryptToken,
    })
    if (!accessToken) return NOT_CONNECTED('invalid_credentials')

    const events = await this.gateway.listEvents(accessToken, {
      timeMin: input.start,
      timeMax: input.end,
    })

    const cfg = integration.getConfig()
    return {
      events: await this.withoutMirrored(events, input),
      connected: true,
      email: typeof cfg.email === 'string' ? cfg.email : null,
    }
  }

  /** Descarta los que ya existen como evento del CRM espejado en Google. */
  private async withoutMirrored(
    events: GoogleCalendarEvent[],
    input: ListGoogleCalendarEventsInput,
  ): Promise<GoogleCalendarEvent[]> {
    if (events.length === 0) return events
    try {
      const own = await this.calendarRepo.findByOrg(input.orgId, {
        start: input.start,
        end: input.end,
      })
      const mirrored = new Set(
        own.map((e) => e.google_event_id).filter((id): id is string => !!id),
      )
      if (mirrored.size === 0) return events
      return events.filter((e) => !mirrored.has(e.id))
    } catch {
      // Si no se pueden leer los propios, es mejor mostrar de más que romper
      // el calendario entero.
      return events
    }
  }
}
