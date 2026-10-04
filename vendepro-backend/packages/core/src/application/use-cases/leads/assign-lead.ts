import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { NotificationRepository } from '../../ports/repositories/notification-repository'
import type { ActivityRepository } from '../../ports/repositories/activity-repository'
import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { EmailService } from '../../ports/services/email-service'
import type { IdGenerator } from '../../ports/id-generator'
import { Notification } from '../../../domain/entities/notification'
import { Activity } from '../../../domain/entities/activity'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canSeeAll } from '../../../domain/rules/role-rules'
import { renderEmailHtml, renderEmailText, VENDEPRO_BRAND } from '../../../domain/rules/email-template'
import type { EmailBrand } from '../../../domain/rules/email-template'

export interface AssignLeadInput {
  leadId: string
  orgId: string
  /** Agente que recibe el lead. */
  toAgentId: string
  /** Quién delega (del token). */
  actorId: string
  actorRole: string
  /** Instrucción opcional que viaja en el aviso ("llamalo hoy, pide tasación"). */
  note?: string | null
}

export interface AssignLeadResult {
  leadId: string
  fromAgentId: string | null
  toAgentId: string
  /** El lead ya estaba en manos de ese agente: no se avisó nada. */
  unchanged: boolean
  notified: boolean
  emailed: boolean
  /** Por qué no salió el mail (sin config, sin casilla, error del provider). */
  emailSkipped?: string
}

/**
 * Delega un lead a otro agente: cambia el asignado, le avisa por campana y
 * —si la org tiene el email configurado— por mail, y deja la constancia en la
 * actividad del lead.
 *
 * Existe aparte de `UpdateLeadUseCase` (que también puede tocar `assigned_to`)
 * porque delegar no es editar un campo: tiene permisos propios, avisa a una
 * persona y queda registrado. El update genérico sigue sirviendo para corregir
 * datos del lead sin molestar a nadie.
 *
 * El aviso es best-effort por diseño: si la notificación o el mail fallan, el
 * lead igual queda delegado. Lo contrario —perder la reasignación porque el
 * provider de mail está caído— sería peor.
 */
export class AssignLeadUseCase {
  constructor(
    private readonly leads: LeadRepository,
    private readonly users: UserRepository,
    private readonly notifications: NotificationRepository,
    private readonly activities: ActivityRepository,
    private readonly ids: IdGenerator,
    /** Email + branding: opcionales, el worker los pasa si tiene RESEND_API_KEY. */
    private readonly email?: {
      service?: EmailService
      settings?: EmailSettingsRepository
      orgs?: OrganizationRepository
    },
    /** Base para el link del aviso. Sin esto el link queda relativo. */
    private readonly publicBaseUrl = '',
  ) {}

  async execute(input: AssignLeadInput): Promise<AssignLeadResult> {
    const lead = await this.leads.findById(input.leadId, input.orgId)
    if (!lead) throw new NotFoundError('Lead', input.leadId)

    // Un agente puede pasar un lead propio; ver los de los demás y repartirlos
    // es cosa de admin/supervisor.
    if (!canSeeAll(input.actorRole) && lead.assigned_to !== input.actorId) {
      throw new ForbiddenError('Sólo podés delegar leads que tengas asignados')
    }

    const target = await this.users.findById(input.toAgentId, input.orgId)
    if (!target) throw new NotFoundError('Agente', input.toAgentId)
    if (!target.active) throw new ValidationError('Ese agente está dado de baja')

    const fromAgentId = lead.assigned_to
    if (fromAgentId === input.toAgentId) {
      return { leadId: lead.id, fromAgentId, toAgentId: input.toAgentId, unchanged: true, notified: false, emailed: false }
    }

    lead.update({ assigned_to: input.toAgentId })
    await this.leads.save(lead)

    const actor = await this.users.findById(input.actorId, input.orgId).catch(() => null)
    const actorName = actor?.full_name ?? 'Tu equipo'
    const note = (input.note ?? '').trim() || null
    const leadUrl = `${this.publicBaseUrl}/leads/${lead.id}`

    const notified = await this.notify(input, lead.full_name, actorName, note, leadUrl)
    const mail = await this.sendEmail(input, target.email, target.full_name, lead.full_name, actorName, note, leadUrl)
    await this.logActivity(input, target.full_name, note, lead.contact_id)

    return {
      leadId: lead.id,
      fromAgentId,
      toAgentId: input.toAgentId,
      unchanged: false,
      notified,
      emailed: mail.sent,
      ...(mail.skipped ? { emailSkipped: mail.skipped } : {}),
    }
  }

  private async notify(
    input: AssignLeadInput, leadName: string, actorName: string, note: string | null, leadUrl: string,
  ): Promise<boolean> {
    try {
      await this.notifications.save(
        Notification.create({
          id: this.ids.generate(),
          org_id: input.orgId,
          user_id: input.toAgentId,
          kind: 'lead_assigned',
          title: `${actorName} te delegó un lead: ${leadName}`,
          body: note,
          link_url: leadUrl,
          read: false,
        }),
      )
      return true
    } catch {
      return false
    }
  }

  /** Constancia en la ficha del lead: sin esto nadie sabe por qué cambió de dueño. */
  private async logActivity(
    input: AssignLeadInput, targetName: string, note: string | null, contactId: string | null,
  ): Promise<void> {
    try {
      await this.activities.save(
        Activity.create({
          id: this.ids.generate(),
          org_id: input.orgId,
          agent_id: input.actorId,
          activity_type: 'admin',
          description: `Delegó el lead a ${targetName}${note ? ` — ${note}` : ''}`,
          result: null,
          duration_minutes: null,
          lead_id: input.leadId,
          contact_id: contactId,
          property_id: null,
          appraisal_id: null,
        }),
      )
    } catch {
      // La delegación ya ocurrió; perder la constancia no la invalida.
    }
  }

  private async sendEmail(
    input: AssignLeadInput, to: string, toName: string, leadName: string,
    actorName: string, note: string | null, leadUrl: string,
  ): Promise<{ sent: boolean; skipped?: string }> {
    const service = this.email?.service
    if (!service || !this.email?.settings) return { sent: false, skipped: 'email_no_configurado' }
    if (!to) return { sent: false, skipped: 'agente_sin_email' }

    const settings = await this.email.settings.findByOrg(input.orgId).catch(() => null)
    if (!settings?.from_email) return { sent: false, skipped: 'sin_remitente' }

    const fromName = settings.from_name ?? 'VendéPro'
    const brand = await this.resolveBrand(input.orgId, settings.from_name)
    const subject = `Te delegaron un lead: ${leadName}`
    const text = [
      `${actorName} te delegó el lead ${leadName}.`,
      note ? `Instrucción: ${note}` : null,
      `Abrilo acá: ${leadUrl}`,
    ].filter(Boolean).join('\n\n')

    try {
      await service.send({
        from: { email: settings.from_email, name: fromName },
        to: { email: to, name: toName },
        replyTo: settings.reply_to ?? undefined,
        subject,
        html: renderEmailHtml({
          brand,
          contentHtml: buildAssignmentContent(actorName, leadName, note, leadUrl),
          preheader: `${actorName} te delegó el lead ${leadName}.`,
        }),
        text: renderEmailText({ brand, contentText: text }),
        tags: { kind: 'lead_assigned' },
        // Reintentar el request no puede mandar el aviso dos veces.
        idempotencyKey: `lead-assigned:${input.leadId}:${input.toAgentId}`,
      })
      return { sent: true }
    } catch (err: any) {
      return { sent: false, skipped: err?.message ?? 'error_del_provider' }
    }
  }

  private async resolveBrand(orgId: string, fromName: string | null): Promise<EmailBrand> {
    const fallback: EmailBrand = { ...VENDEPRO_BRAND, name: fromName ?? VENDEPRO_BRAND.name }
    if (!this.email?.orgs) return fallback
    try {
      const org = await this.email.orgs.findById(orgId)
      if (!org) return fallback
      return {
        name: fromName ?? org.name,
        logoUrl: org.logo_url,
        color: org.brand_color,
        accentColor: VENDEPRO_BRAND.accentColor,
      }
    } catch {
      return fallback
    }
  }
}

/** Sólo el contenido: el marco de marca lo pone `renderEmailHtml`. */
function buildAssignmentContent(actorName: string, leadName: string, note: string | null, leadUrl: string): string {
  return `<h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Te delegaron un lead</h2>
<p style="margin:0 0 12px;">
  <strong>${escapeHtml(actorName)}</strong> te pasó el lead
  <strong>${escapeHtml(leadName)}</strong>.
</p>
${note ? `<p style="margin:0 0 12px;padding:12px;background:#f9fafb;border-radius:8px;">${escapeHtml(note)}</p>` : ''}
<p style="margin:0 0 20px;">Recordá que el primer contacto tiene que salir dentro de las 24 horas.</p>
<p style="margin:0;">
  <a href="${escapeHtml(leadUrl)}" style="display:inline-block;padding:12px 20px;background:#ff007c;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">Ver el lead</a>
</p>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
