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
import { readWatchState, writeWatchState } from './google-watch-config'

export interface SyncGoogleCalendarInput {
  orgId: string
  userId: string
  /** Ventana de la primera sincronización (cuando todavía no hay syncToken). */
  windowStart?: string
  windowEnd?: string
}

export interface SyncGoogleCalendarResult {
  imported: number
  updated: number
  removed: number
  skipped: number
  linked: number
  connected: boolean
  /** El token venció y hubo que resincronizar la ventana entera. */
  resynced: boolean
  reason?: string
}

const NOT_CONNECTED = (reason: string): SyncGoogleCalendarResult => ({
  imported: 0, updated: 0, removed: 0, skipped: 0, linked: 0,
  connected: false, resynced: false, reason,
})

const DAY_MS = 86_400_000

/**
 * Sincronización incremental del Google Calendar de un agente.
 *
 * Es el motor que alimenta las dos formas de traer eventos:
 *  - el webhook, cuando Google avisa que algo cambió (segundos de latencia),
 *  - el cron, como red de seguridad si una notificación se pierde.
 *
 * Usa el `syncToken` de la Calendar API: después de la primera pasada, Google
 * devuelve sólo lo que cambió. Sin eso habría que releer meses de agenda en
 * cada notificación, y Google notifica por CADA edición.
 */
export class SyncGoogleCalendarUseCase {
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

  async execute(input: SyncGoogleCalendarInput): Promise<SyncGoogleCalendarResult> {
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

    const now = Date.now()
    const windowStart = input.windowStart ?? new Date(now - 30 * DAY_MS).toISOString()
    const windowEnd = input.windowEnd ?? new Date(now + 90 * DAY_MS).toISOString()

    const state = readWatchState(integration)
    let page = await this.gateway.listChanges(accessToken, {
      syncToken: state.sync_token ?? null,
      timeMin: windowStart,
      timeMax: windowEnd,
    })

    // El token venció: Google exige empezar de nuevo. Se relee la ventana
    // entera, que es idempotente, y se guarda el token nuevo.
    let resynced = false
    if (page.sync_token_expired) {
      resynced = true
      page = await this.gateway.listChanges(accessToken, {
        syncToken: null,
        timeMin: windowStart,
        timeMax: windowEnd,
      })
    }

    // Los eventos del CRM se leen UNA vez y se indexan por id de Google. Antes
    // buscaba dentro del loop: con una agenda de cientos, eso era una lectura
    // de toda la tabla por cada evento cambiado.
    const byGoogleId = new Map<string, CalendarEvent>()
    for (const own of await this.calendarRepo.findByOrg(input.orgId, {})) {
      if (own.google_event_id) byGoogleId.set(own.google_event_id, own)
    }

    const result = await this.applyChanges(page.events, input, byGoogleId)

    if (page.next_sync_token) {
      writeWatchState(integration, { sync_token: page.next_sync_token })
      integration.update({ last_sync_at: new Date().toISOString() })
      await this.integrationRepo.save(integration)
    }

    return { ...result, connected: true, resynced }
  }

  private async applyChanges(
    events: GoogleCalendarEvent[],
    input: SyncGoogleCalendarInput,
    byGoogleId: Map<string, CalendarEvent>,
  ): Promise<Omit<SyncGoogleCalendarResult, 'connected' | 'resynced'>> {
    let imported = 0, updated = 0, removed = 0, skipped = 0, linked = 0

    for (const ev of events) {
      const existing = byGoogleId.get(ev.id) ?? null

      if (ev.status === 'cancelled') {
        // Se borró en Google. Si el evento del CRM ya está completado no se
        // toca: el trabajo pasó, y borrarlo se llevaría puesta la actividad
        // comercial que se derivó de él.
        if (existing && existing.completed === 1) { skipped++; continue }
        if (existing) {
          await this.calendarRepo.delete(existing.id, input.orgId)
          byGoogleId.delete(ev.id)
          removed++
        } else {
          skipped++
        }
        continue
      }

      if (existing) {
        existing.applyExternalEdit({
          title: ev.summary ?? '',
          startAt: ev.start,
          endAt: ev.end,
          allDay: ev.all_day ? 1 : 0,
          description: ev.description,
        })
        await this.calendarRepo.save(existing)
        updated++
        continue
      }

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

    return { imported, updated, removed, skipped, linked }
  }

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
        // Un término que falla no puede tumbar la sincronización entera.
      }
    }
    return null
  }
}
