import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'
import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { GoogleCalendarGateway, GoogleCalendarEvent } from '../../ports/services/google-calendar-gateway'
import type { IdGenerator } from '../../ports/id-generator'
import type { TokenEncryptor } from '../marketing/save-meta-integration'
import type { TokenDecryptor } from './test-kiteprop-connection'
import { CalendarEvent } from '../../../domain/entities/calendar-event'
import {
  classifyGoogleEventType,
  matchNameInTitle,
  candidateNameTerms,
} from '../../../domain/rules/google-event-import-rules'
import { GOOGLE_CALENDAR_PROVIDER } from './get-google-integration'
import { getValidGoogleAccessToken } from './google-access-token'

export interface ImportGoogleCalendarEventsInput {
  orgId: string
  /** Dueño del calendario. Sale del token: nadie importa la agenda de otro. */
  userId: string
  /** Ventana a importar, en ISO. */
  start: string
  end: string
}

export interface ImportGoogleCalendarEventsResult {
  imported: number
  /** Ya estaban en el CRM (importados antes, o espejados desde acá). */
  skipped: number
  /** Vinculados a un lead o contacto por el nombre en el título. */
  linked: number
  connected: boolean
  reason?: string
}

const NOT_CONNECTED = (reason: string): ImportGoogleCalendarEventsResult => ({
  imported: 0, skipped: 0, linked: 0, connected: false, reason,
})

/**
 * Trae al CRM los eventos que el agente agendó en su Google Calendar.
 *
 * Es la dirección que faltaba: hasta acá el CRM empujaba sus eventos a Google
 * pero lo que se agendaba en Google no existía para el CRM. Eso dejaba afuera
 * justo el trabajo de campo —las visitas y tasaciones se agendan sobre la
 * marcha, desde el teléfono, en el calendario— que es el que después alimenta
 * las métricas de actividad.
 *
 * Al importarse, el evento queda como cualquier otro del CRM: tipificado por
 * palabra clave, vinculado al lead o contacto si el nombre está en el título,
 * y —al tildarlo como completado— registra la actividad comercial.
 *
 * Es idempotente: cada evento de Google entra una sola vez, identificado por
 * `google_event_id`. Eso también evita el eco, porque los eventos que el CRM
 * espejó en Google ya tienen ese id ocupado.
 */
export class ImportGoogleCalendarEventsUseCase {
  constructor(
    private readonly integrationRepo: UserIntegrationRepository,
    private readonly calendarRepo: CalendarRepository,
    private readonly leadRepo: LeadRepository,
    private readonly contactRepo: ContactRepository,
    private readonly gateway: GoogleCalendarGateway,
    private readonly ids: IdGenerator,
    private readonly encryptToken: TokenEncryptor,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: ImportGoogleCalendarEventsInput): Promise<ImportGoogleCalendarEventsResult> {
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

    const googleEvents = await this.gateway.listEvents(accessToken, {
      timeMin: input.start,
      timeMax: input.end,
    })

    const known = await this.knownGoogleEventIds(input)
    let imported = 0
    let skipped = 0
    let linked = 0

    for (const ev of googleEvents) {
      // Cancelado en Google: no se trae. Si ya se había importado, tampoco se
      // borra el del CRM — puede tener actividad registrada encima.
      if (ev.status === 'cancelled') { skipped++; continue }
      if (known.has(ev.id)) { skipped++; continue }

      const link = await this.findLink(input.orgId, ev.summary)
      if (link) linked++

      await this.calendarRepo.save(CalendarEvent.create({
        id: this.ids.generate(),
        org_id: input.orgId,
        agent_id: input.userId,
        title: ev.summary?.trim() || 'Evento de Google Calendar',
        event_type: classifyGoogleEventType(ev.summary),
        start_at: ev.start,
        end_at: ev.end,
        all_day: ev.all_day ? 1 : 0,
        description: ev.description,
        lead_id: link?.kind === 'lead' ? link.id : null,
        contact_id: link?.kind === 'contact' ? link.id : null,
        property_id: null,
        appraisal_id: null,
        reservation_id: null,
        color: null,
        completed: 0,
        google_event_id: ev.id,
      }))
      imported++
    }

    return { imported, skipped, linked, connected: true }
  }

  /** Ids de Google que el CRM ya tiene, importados o espejados. */
  private async knownGoogleEventIds(input: ImportGoogleCalendarEventsInput): Promise<Set<string>> {
    const own = await this.calendarRepo.findByOrg(input.orgId, {
      start: input.start,
      end: input.end,
    })
    return new Set(own.map(e => e.google_event_id).filter((id): id is string => !!id))
  }

  /**
   * Vincula por el nombre que aparezca en el título. Primero leads (el trabajo
   * vivo) y después contactos. Se buscan sólo los términos plausibles del
   * título en vez de traer la cartera entera a memoria.
   */
  private async findLink(
    orgId: string,
    summary: string | null,
  ): Promise<{ kind: 'lead' | 'contact'; id: string } | null> {
    const terms = candidateNameTerms(summary)
    if (terms.length === 0) return null

    for (const term of terms) {
      try {
        const leads = await this.leadRepo.searchByName(orgId, term, 10)
        const leadMatch = matchNameInTitle(summary, leads)
        if (leadMatch) return { kind: 'lead', id: leadMatch.id }

        const contacts = await this.contactRepo.searchByName(orgId, term, 10)
        const contactMatch = matchNameInTitle(summary, contacts)
        if (contactMatch) return { kind: 'contact', id: contactMatch.id }
      } catch {
        // Un término que falla no puede tumbar la importación entera: el
        // evento entra igual, sólo que sin vincular.
      }
    }
    return null
  }
}
