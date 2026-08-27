import { Notification, htmlToText } from '@vendepro/core'
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
  UnsubscribeTokenSigner,
  IdGenerator,
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
    let html = String(input.config.body_html ?? '')
    if (!subject || !html) return { status: 'skipped', reason: 'empty_content' }

    // El link de baja se resuelve acá, no en la interpolación: necesita firmar
    // con el email real del destinatario.
    const includeUnsubscribe = input.config.include_unsubscribe !== false
    if (includeUnsubscribe) {
      const token = await this.unsubscribeSigner.sign({ orgId: input.orgId, email: recipient.email })
      const url = `${trimSlash(this.publicBaseUrl)}/u/${token}`
      html = html.includes('{{unsubscribe_url}}')
        ? html.replaceAll('{{unsubscribe_url}}', url)
        : html + unsubscribeFooter(url)
    }

    const agentEmail = readString(input.context, 'agent', 'email')
    const replyTo = input.config.reply_to_agent !== false && agentEmail
      ? agentEmail
      : settings.reply_to ?? undefined

    await this.email.send({
      from: { email: settings.from_email, name: settings.from_name ?? 'VendéPro' },
      to: { email: recipient.email, name: recipient.name ?? recipient.email },
      replyTo,
      subject,
      html,
      text: htmlToText(html),
      tags: { kind: 'automation', automation_id: input.automationId },
      // Un reintento del mismo job no puede mandar el mail dos veces.
      idempotencyKey: `automation:${input.runId}:${input.automationId}`,
    })

    return { status: 'success', result: { to: recipient.email, subject } }
  }
}

function unsubscribeFooter(url: string): string {
  return `<p style="color:#999;font-size:12px;margin-top:24px;">
  Si no querés recibir más estos mensajes, <a href="${url}" style="color:#999;">date de baja acá</a>.
</p>`
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
