import {
  Notification, CalendarEvent, htmlToText,
  renderEmailHtml, renderEmailText, VENDEPRO_BRAND,
} from '@vendepro/core'
import type { EmailBrand } from '@vendepro/core'
// Desde el subpath del dominio: en el barrel raíz `EVENT_TYPES` choca con el
// mapa de config de `shared/crm-config`, y esbuild corta el build con
// "Ambiguous import" aunque TypeScript no diga nada.
import { EVENT_TYPES } from '@vendepro/core/domain'
import type {
  AutomationActionExecutor,
  AutomationExecutorRegistry,
  ActionExecutionInput,
  ActionOutcome,
  EmailSettingsRepository,
  EmailSuppressionRepository,
  EmailService,
  NotificationRepository,
  UserRepository,
  CalendarRepository,
  UnsubscribeTokenSigner,
  IdGenerator,
  EventTypeValue,
} from '@vendepro/core'

/**
 * Ejecutores de las acciones de automatización.
 *
 * Contrato: un problema de datos esperable (destinatario sin email, contacto
 * dado de baja, envío apagado) devuelve `skipped` con el motivo. Sólo se lanza
 * ante fallas de infraestructura, que sí ameritan reintento.
 */

// ── send_email ────────────────────────────────────────────────

export class SendEmailActionExecutor implements AutomationActionExecutor {
  readonly type = 'send_email'

  constructor(
    private readonly settings: EmailSettingsRepository,
    private readonly suppressions: EmailSuppressionRepository,
    private readonly email: EmailService,
    private readonly unsubscribeSigner: UnsubscribeTokenSigner,
    private readonly publicBaseUrl: string,
  ) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    const recipient = resolveRecipient(input.context)
    if (!recipient.email) return { status: 'skipped', reason: 'no_recipient' }

    const settings = await this.settings.findByOrg(input.orgId)
    if (!settings?.from_email) return { status: 'skipped', reason: 'email_not_configured' }
    if (!settings.enabled) return { status: 'skipped', reason: 'email_disabled' }

    // La lista de bajas manda siempre, sin excepción y sin importar la config
    // de la acción: es lo que mantiene sano el dominio de envío.
    const suppressed = await this.suppressions.findByEmail(input.orgId, recipient.email)
    if (suppressed) return { status: 'skipped', reason: 'suppressed' }

    const subject = String(input.config.subject ?? '').trim()
    let content = String(input.config.body_html ?? '')
    if (!subject || !content) return { status: 'skipped', reason: 'empty_content' }

    // El link de baja se resuelve acá, no en la interpolación: necesita firmar
    // con el email real del destinatario.
    const includeUnsubscribe = input.config.include_unsubscribe !== false
    let footerUnsubscribeUrl: string | null = null
    if (includeUnsubscribe) {
      const token = await this.unsubscribeSigner.sign({ orgId: input.orgId, email: recipient.email })
      const url = `${trimSlash(this.publicBaseUrl)}/u/${token}`
      // Si el autor puso el token en el cuerpo, ese es el lugar que eligió para
      // el link; si no, lo pone el footer del template. Nunca los dos.
      if (content.includes('{{unsubscribe_url}}')) content = content.replaceAll('{{unsubscribe_url}}', url)
      else footerUnsubscribeUrl = url
    }

    const agentEmail = readString(input.context, 'agent', 'email')
    const replyTo = input.config.reply_to_agent !== false && agentEmail
      ? agentEmail
      : settings.reply_to ?? undefined

    // La marca sale del contexto del evento, que ya trae la org resuelta.
    const brand: EmailBrand = {
      name: settings.from_name ?? readString(input.context, 'org', 'name') ?? VENDEPRO_BRAND.name,
      logoUrl: readString(input.context, 'org', 'logo_url'),
      color: readString(input.context, 'org', 'brand_color'),
      accentColor: VENDEPRO_BRAND.accentColor,
    }

    await this.email.send({
      from: { email: settings.from_email, name: settings.from_name ?? 'VendéPro' },
      to: { email: recipient.email, name: recipient.name ?? recipient.email },
      replyTo,
      subject,
      html: renderEmailHtml({ brand, contentHtml: content, unsubscribeUrl: footerUnsubscribeUrl }),
      // El texto sale del contenido, no del documento envuelto: si no, arrastra
      // el encabezado y el footer del marco duplicados.
      text: renderEmailText({
        brand,
        contentText: htmlToText(content),
        unsubscribeUrl: footerUnsubscribeUrl,
      }),
      tags: { kind: 'automation', automation_id: input.automationId },
      // Un reintento del mismo job no puede mandar el mail dos veces.
      idempotencyKey: `automation:${input.runId}:${input.automationId}`,
    })

    return { status: 'success', result: { to: recipient.email, subject } }
  }
}

// ── notify_agent ──────────────────────────────────────────────

export class NotifyAgentActionExecutor implements AutomationActionExecutor {
  readonly type = 'notify_agent'

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly users: UserRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    const title = String(input.config.title ?? '').trim()
    const message = String(input.config.message ?? '').trim()
    if (!title) return { status: 'skipped', reason: 'empty_content' }

    const targets = await this.resolveTargets(input)
    if (targets.length === 0) return { status: 'skipped', reason: 'no_recipient' }

    for (const userId of targets) {
      await this.notifications.save(
        Notification.create({
          id: this.ids.generate(),
          org_id: input.orgId,
          user_id: userId,
          // La tabla restringe `kind` por CHECK; las de automatización entran
          // como 'system' hasta que una migración extienda el catálogo.
          kind: 'system',
          title,
          body: message || null,
          link_url: entityLink(input.context),
          read: false,
        }),
      )
    }

    return { status: 'success', result: { notified: targets.length, user_ids: targets } }
  }

  private async resolveTargets(input: ActionExecutionInput): Promise<string[]> {
    const target = String(input.config.target ?? 'assigned_agent')

    if (target === 'specific_user') {
      const userId = String(input.config.user_id ?? '').trim()
      return userId ? [userId] : []
    }

    if (target === 'admins') {
      const admins = await this.users.findByOrg(input.orgId)
      return admins
        .filter((u) => (u.role === 'admin' || u.role === 'owner') && u.active)
        .map((u) => u.id)
    }

    const agentId = readString(input.context, 'agent', 'id')
    return agentId ? [agentId] : []
  }
}

// ── create_calendar_event ─────────────────────────────────────

/**
 * Espejo del evento en el Google Calendar del agente. Se inyecta como función
 * para no arrastrar a este módulo la dependencia de OAuth: el worker que tenga
 * las credenciales la provee, y el que no, simplemente no la pasa.
 */
export type CalendarMirror = (input: {
  orgId: string
  agentId: string
  eventId: string
}) => Promise<{ synced: boolean; inviteSent: boolean; reason?: string } | null>

export class CreateCalendarEventActionExecutor implements AutomationActionExecutor {
  readonly type = 'create_calendar_event'

  constructor(
    private readonly calendar: CalendarRepository,
    private readonly ids: IdGenerator,
    private readonly mirrorToGoogle?: CalendarMirror,
  ) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    const title = String(input.config.title ?? '').trim()
    if (!title) return { status: 'skipped', reason: 'empty_content' }

    // Sin agente no hay calendario donde ponerlo: los eventos son por agente.
    const agentId = readString(input.context, 'agent', 'id')
    if (!agentId) return { status: 'skipped', reason: 'no_recipient' }

    const dueInDays = toPositiveNumber(input.config.due_in_days, 7)
    const dueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60_000).toISOString()

    const event = CalendarEvent.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      agent_id: agentId,
      title,
      event_type: normalizeEventType(input.config.event_type),
      start_at: dueAt,
      end_at: dueAt,
      all_day: 0,
      description: String(input.config.description ?? '') || null,
      lead_id: readString(input.context, 'lead', 'id'),
      contact_id: readString(input.context, 'contact', 'id'),
      property_id: readString(input.context, 'property', 'id'),
      appraisal_id: readString(input.context, 'appraisal', 'id'),
      reservation_id: null,
      color: null,
      completed: 0,
    })
    await this.calendar.save(event)

    // El espejo en Google es un extra, no la acción: si el agente no conectó su
    // cuenta o Google falla, la tarea igual quedó creada en el CRM y eso es lo
    // que el negocio necesitaba. Se reporta en el resultado, no como fallo.
    let google: { synced: boolean; inviteSent: boolean; reason?: string } | null = null
    if (this.mirrorToGoogle) {
      try {
        google = await this.mirrorToGoogle({ orgId: input.orgId, agentId, eventId: event.id })
      } catch (err) {
        google = { synced: false, inviteSent: false, reason: (err as Error)?.message ?? 'mirror_failed' }
      }
    }

    return {
      status: 'success',
      result: {
        event_id: event.id,
        agent_id: agentId,
        due_at: dueAt,
        google_synced: google?.synced ?? false,
        ...(google?.reason ? { google_reason: google.reason } : {}),
      },
    }
  }
}

function normalizeEventType(raw: unknown): EventTypeValue {
  const value = typeof raw === 'string' ? raw.trim() : ''
  return (EVENT_TYPES as readonly string[]).includes(value)
    ? (value as EventTypeValue)
    : 'seguimiento'
}

function toPositiveNumber(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// ── Registry ──────────────────────────────────────────────────

export class MapExecutorRegistry implements AutomationExecutorRegistry {
  private readonly byType: Map<string, AutomationActionExecutor>

  constructor(executors: readonly AutomationActionExecutor[]) {
    this.byType = new Map(executors.map((e) => [e.type, e]))
  }

  get(actionType: string): AutomationActionExecutor | null {
    return this.byType.get(actionType) ?? null
  }
}

// ── Helpers ───────────────────────────────────────────────────

/** El destinatario del cliente sale del lead; si no hay, del contacto. */
function resolveRecipient(context: Record<string, unknown>): { email: string | null; name: string | null } {
  const email = readString(context, 'lead', 'email') ?? readString(context, 'contact', 'email')
  const name = readString(context, 'lead', 'full_name') ?? readString(context, 'contact', 'full_name')
  return { email: email ? email.trim().toLowerCase() : null, name }
}

/** Link al detalle de la entidad, para que la notificación sea accionable. */
function entityLink(context: Record<string, unknown>): string | null {
  const leadId = readString(context, 'lead', 'id')
  if (leadId) return `/leads?id=${leadId}`
  const propertyId = readString(context, 'property', 'id')
  if (propertyId) return `/propiedades/${propertyId}`
  const contactId = readString(context, 'contact', 'id')
  if (contactId) return `/contactos?id=${contactId}`
  return null
}

function readString(context: Record<string, unknown>, scope: string, key: string): string | null {
  const container = context[scope]
  if (!container || typeof container !== 'object') return null
  const value = (container as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
