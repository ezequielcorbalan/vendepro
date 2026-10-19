import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { NotificationRepository } from '../../ports/repositories/notification-repository'
import type { ActivityRepository } from '../../ports/repositories/activity-repository'
import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { EmailService } from '../../ports/services/email-service'
import type { IdGenerator } from '../../ports/id-generator'
import type { User } from '../../../domain/entities/user'
import { Notification } from '../../../domain/entities/notification'
import { Activity } from '../../../domain/entities/activity'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canSeeAll } from '../../../domain/rules/role-rules'
import { renderEmailHtml, renderEmailText, VENDEPRO_BRAND } from '../../../domain/rules/email-template'
import type { EmailBrand } from '../../../domain/rules/email-template'

/** Tope por request: repartir la cola es de a decenas, no de a miles. */
const MAX_BULK = 100

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

export interface AssignLeadsInput extends Omit<AssignLeadInput, 'leadId'> {
  leadIds: string[]
}

export type AssignFailureReason = 'no_encontrado' | 'sin_permiso'

export interface AssignLeadsResult {
  toAgentId: string
  /** Los que efectivamente cambiaron de dueño. */
  assigned: string[]
  /** Ya eran de ese agente: no se tocaron ni se avisaron. */
  unchanged: string[]
  /** Los que no se pudieron mover, con el motivo. */
  failed: Array<{ leadId: string; reason: AssignFailureReason }>
  notified: boolean
  emailed: boolean
  emailSkipped?: string
}

interface LeadOutcome {
  leadId: string
  status: 'assigned' | 'unchanged' | AssignFailureReason
  fromAgentId: string | null
  leadName: string | null
}

/**
 * Delega leads a otro agente: cambia el asignado, le avisa por campana y —si la
 * org tiene el email configurado— por mail, y deja la constancia en la
 * actividad de cada lead.
 *
 * Existe aparte de `UpdateLeadUseCase` (que también puede tocar `assigned_to`)
 * porque delegar no es editar un campo: tiene permisos propios, avisa a una
 * persona y queda registrado. El update genérico sigue sirviendo para corregir
 * datos del lead sin molestar a nadie.
 *
 * `executeMany` reparte varios de una. Avisa **una sola vez** por tanda: cinco
 * leads delegados juntos son una decisión, no cinco, y cinco campanazos
 * seguidos se leen como ruido y no como trabajo que llegó. La constancia sí va
 * por lead, que es donde después se la busca.
 *
 * El aviso es best-effort por diseño: si la notificación o el mail fallan, los
 * leads igual quedan delegados. Lo contrario —perder la reasignación porque el
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

  /** Un lead. Los problemas se tiran como error: el que delega mira ese lead. */
  async execute(input: AssignLeadInput): Promise<AssignLeadResult> {
    const target = await this.resolveTarget(input.orgId, input.toAgentId)
    const [outcome] = await this.reassign({ ...input, leadIds: [input.leadId] }, target)

    if (outcome!.status === 'no_encontrado') throw new NotFoundError('Lead', input.leadId)
    if (outcome!.status === 'sin_permiso') throw new ForbiddenError('Sólo podés delegar leads que tengas asignados')

    if (outcome!.status === 'unchanged') {
      return {
        leadId: input.leadId, fromAgentId: outcome!.fromAgentId, toAgentId: input.toAgentId,
        unchanged: true, notified: false, emailed: false,
      }
    }

    const aviso = await this.announce(input, target, [outcome!])
    return {
      leadId: input.leadId,
      fromAgentId: outcome!.fromAgentId,
      toAgentId: input.toAgentId,
      unchanged: false,
      notified: aviso.notified,
      emailed: aviso.emailed,
      ...(aviso.emailSkipped ? { emailSkipped: aviso.emailSkipped } : {}),
    }
  }

  /**
   * Varios leads de una. Acá los problemas NO cortan la tanda: que un lead sea
   * de otro agente no es razón para no repartir los otros veinte. Se devuelven
   * en `failed` para que la UI diga qué quedó afuera.
   */
  async executeMany(input: AssignLeadsInput): Promise<AssignLeadsResult> {
    const leadIds = Array.from(new Set(input.leadIds ?? []))
    if (leadIds.length === 0) throw new ValidationError('No hay leads para delegar')
    if (leadIds.length > MAX_BULK) {
      throw new ValidationError(`No se pueden delegar más de ${MAX_BULK} leads a la vez`)
    }

    const target = await this.resolveTarget(input.orgId, input.toAgentId)
    const outcomes = await this.reassign({ ...input, leadIds }, target)
    const assigned = outcomes.filter(o => o.status === 'assigned')

    const aviso = assigned.length > 0
      ? await this.announce(input, target, assigned)
      : { notified: false, emailed: false, emailSkipped: undefined as string | undefined }

    return {
      toAgentId: input.toAgentId,
      assigned: assigned.map(o => o.leadId),
      unchanged: outcomes.filter(o => o.status === 'unchanged').map(o => o.leadId),
      failed: outcomes
        .filter(o => o.status === 'no_encontrado' || o.status === 'sin_permiso')
        .map(o => ({ leadId: o.leadId, reason: o.status as AssignFailureReason })),
      notified: aviso.notified,
      emailed: aviso.emailed,
      ...(aviso.emailSkipped ? { emailSkipped: aviso.emailSkipped } : {}),
    }
  }

  /** El agente destino se valida una vez por tanda, no por lead. */
  private async resolveTarget(orgId: string, toAgentId: string): Promise<User> {
    const target = await this.users.findById(toAgentId, orgId)
    if (!target) throw new NotFoundError('Agente', toAgentId)
    if (!target.active) throw new ValidationError('Ese agente está dado de baja')
    return target
  }

  /** Mueve cada lead y deja su constancia. No avisa: eso va una vez por tanda. */
  private async reassign(input: AssignLeadsInput, target: User): Promise<LeadOutcome[]> {
    const puedeRepartirAjenos = canSeeAll(input.actorRole)
    const note = (input.note ?? '').trim() || null
    const outcomes: LeadOutcome[] = []

    for (const leadId of input.leadIds) {
      const lead = await this.leads.findById(leadId, input.orgId)
      if (!lead) {
        outcomes.push({ leadId, status: 'no_encontrado', fromAgentId: null, leadName: null })
        continue
      }
      // Un agente puede pasar un lead propio; ver los de los demás y
      // repartirlos es cosa de admin/supervisor.
      if (!puedeRepartirAjenos && lead.assigned_to !== input.actorId) {
        outcomes.push({ leadId, status: 'sin_permiso', fromAgentId: lead.assigned_to, leadName: lead.full_name })
        continue
      }
      if (lead.assigned_to === input.toAgentId) {
        outcomes.push({ leadId, status: 'unchanged', fromAgentId: lead.assigned_to, leadName: lead.full_name })
        continue
      }

      const fromAgentId = lead.assigned_to
      lead.update({ assigned_to: input.toAgentId })
      await this.leads.save(lead)
      await this.logActivity(input, leadId, target.full_name, note, lead.contact_id)
      outcomes.push({ leadId, status: 'assigned', fromAgentId, leadName: lead.full_name })
    }

    return outcomes
  }

  /** Un solo aviso por tanda: campana + mail. */
  private async announce(
    input: Omit<AssignLeadInput, 'leadId'>, target: User, assigned: LeadOutcome[],
  ): Promise<{ notified: boolean; emailed: boolean; emailSkipped?: string }> {
    const actor = await this.users.findById(input.actorId, input.orgId).catch(() => null)
    const actorName = actor?.full_name ?? 'Tu equipo'
    const note = (input.note ?? '').trim() || null

    // Un lead: el aviso lleva su nombre y entra directo a la ficha. Varios: el
    // link va a la lista filtrada por el agente, que es lo que va a querer ver.
    const uno = assigned.length === 1 ? assigned[0]! : null
    const titulo = uno
      ? `${actorName} te delegó un lead: ${uno.leadName}`
      : `${actorName} te delegó ${assigned.length} leads`
    const url = uno
      ? `${this.publicBaseUrl}/leads/${uno.leadId}`
      : `${this.publicBaseUrl}/leads?agent=${input.toAgentId}`

    const notified = await this.notify(input.orgId, input.toAgentId, titulo, note, url)
    const mail = await this.sendEmail(input, target, titulo, note, url, assigned)
    return { notified, emailed: mail.sent, emailSkipped: mail.skipped }
  }

  private async notify(
    orgId: string, userId: string, title: string, body: string | null, linkUrl: string,
  ): Promise<boolean> {
    try {
      await this.notifications.save(
        Notification.create({
          id: this.ids.generate(),
          org_id: orgId,
          user_id: userId,
          kind: 'lead_assigned',
          title,
          body,
          link_url: linkUrl,
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
    input: Omit<AssignLeadInput, 'leadId'>, leadId: string, targetName: string,
    note: string | null, contactId: string | null,
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
          lead_id: leadId,
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
    input: Omit<AssignLeadInput, 'leadId'>, target: User, titulo: string,
    note: string | null, url: string, assigned: LeadOutcome[],
  ): Promise<{ sent: boolean; skipped?: string }> {
    const service = this.email?.service
    if (!service || !this.email?.settings) return { sent: false, skipped: 'email_no_configurado' }
    if (!target.email) return { sent: false, skipped: 'agente_sin_email' }

    const settings = await this.email.settings.findByOrg(input.orgId).catch(() => null)
    if (!settings?.from_email) return { sent: false, skipped: 'sin_remitente' }

    const fromName = settings.from_name ?? 'VendéPro'
    const brand = await this.resolveBrand(input.orgId, settings.from_name)
    const nombres = assigned.map(o => o.leadName).filter(Boolean) as string[]
    const varios = assigned.length > 1
    const text = [
      `${titulo}.`,
      varios ? nombres.join(', ') : null,
      note ? `Instrucción: ${note}` : null,
      `Abrilos acá: ${url}`,
    ].filter(Boolean).join('\n\n')

    try {
      await service.send({
        from: { email: settings.from_email, name: fromName },
        to: { email: target.email, name: target.full_name },
        replyTo: settings.reply_to ?? undefined,
        subject: varios
          ? `Te delegaron ${assigned.length} leads`
          : `Te delegaron un lead: ${nombres[0] ?? ''}`.trim(),
        html: renderEmailHtml({
          brand,
          contentHtml: buildAssignmentContent(titulo, nombres, note, url),
          preheader: titulo,
        }),
        text: renderEmailText({ brand, contentText: text }),
        tags: { kind: 'lead_assigned' },
        // Reintentar el request no puede mandar el aviso dos veces.
        idempotencyKey: `lead-assigned:${input.toAgentId}:${assigned.map(o => o.leadId).sort().join('-')}`,
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
function buildAssignmentContent(titulo: string, nombres: string[], note: string | null, url: string): string {
  const lista = nombres.length > 1
    ? `<ul style="margin:0 0 12px;padding-left:20px;">${nombres.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
    : ''
  return `<h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${escapeHtml(titulo)}</h2>
${lista}
${note ? `<p style="margin:0 0 12px;padding:12px;background:#f9fafb;border-radius:8px;">${escapeHtml(note)}</p>` : ''}
<p style="margin:0 0 20px;">Recordá que el primer contacto tiene que salir dentro de las 24 horas.</p>
<p style="margin:0;">
  <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#ff007c;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">${nombres.length > 1 ? 'Ver los leads' : 'Ver el lead'}</a>
</p>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
