import {
  Activity, Tag, htmlToText,
  renderEmailHtml, renderEmailText, VENDEPRO_BRAND,
  AdvanceLeadStageUseCase, UpdatePropertyStageUseCase,
  ValidationError, NotFoundError,
} from '@vendepro/core'
import type { EmailBrand } from '@vendepro/core'
import type {
  AutomationActionExecutor,
  ActionExecutionInput,
  ActionOutcome,
  ActivityRepository,
  TagRepository,
  LeadRepository,
  UserRepository,
  EmailSettingsRepository,
  EmailService,
  WebhookSender,
  IdGenerator,
} from '@vendepro/core'
import type { ActivityType } from '@vendepro/core'
import { readString } from './automation-executors'

/**
 * Fase 2 de los ejecutores: las acciones que mutan el CRM (asignar, etiquetar,
 * cambiar etapa, registrar actividad) más las salidas internas (email al
 * equipo, webhook). Mismo contrato que la fase 1: un problema de datos
 * esperable devuelve `skipped` con el motivo; sólo las fallas de
 * infraestructura lanzan (y por lo tanto reintentan).
 */

// ── log_activity ──────────────────────────────────────────────

const VALID_ACTIVITY_TYPES: readonly string[] = [
  'llamada', 'whatsapp', 'reunion', 'visita_captacion', 'visita_comprador',
  'tasacion', 'presentacion', 'seguimiento', 'documentacion', 'admin', 'cierre',
]

export class LogActivityActionExecutor implements AutomationActionExecutor {
  readonly type = 'log_activity'

  constructor(
    private readonly activities: ActivityRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    // activities.agent_id es NOT NULL: sin agente en el evento no hay a quién
    // atribuir la actividad.
    const agentId = readString(input.context, 'agent', 'id')
    if (!agentId) return { status: 'skipped', reason: 'no_recipient' }

    const notes = String(input.config.notes ?? '').trim()
    if (!notes) return { status: 'skipped', reason: 'empty_content' }

    // El dominio valida el enum de tipos; lo que no matchea ('automatizacion'
    // de recetas viejas incluido) cae a 'seguimiento' en vez de romper el job.
    const requested = String(input.config.activity_type ?? '').trim()
    const activityType = (VALID_ACTIVITY_TYPES.includes(requested) ? requested : 'seguimiento') as ActivityType

    const activity = Activity.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      agent_id: agentId,
      activity_type: activityType,
      description: notes,
      result: null,
      duration_minutes: null,
      lead_id: readString(input.context, 'lead', 'id'),
      contact_id: readString(input.context, 'contact', 'id'),
      property_id: readString(input.context, 'property', 'id'),
      appraisal_id: readString(input.context, 'appraisal', 'id'),
    })
    await this.activities.save(activity)

    return { status: 'success', result: { activity_id: activity.id, activity_type: activityType } }
  }
}

// ── send_internal_email ───────────────────────────────────────

export class SendInternalEmailActionExecutor implements AutomationActionExecutor {
  readonly type = 'send_internal_email'

  constructor(
    private readonly settings: EmailSettingsRepository,
    private readonly users: UserRepository,
    private readonly email: EmailService,
  ) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    const subject = String(input.config.subject ?? '').trim()
    const content = String(input.config.body_html ?? '')
    if (!subject || !content) return { status: 'skipped', reason: 'empty_content' }

    const settings = await this.settings.findByOrg(input.orgId)
    if (!settings?.from_email) return { status: 'skipped', reason: 'email_not_configured' }
    if (!settings.enabled) return { status: 'skipped', reason: 'email_disabled' }

    const recipients = await this.resolveRecipients(input)
    if (recipients.length === 0) return { status: 'skipped', reason: 'no_recipient' }

    const brand: EmailBrand = {
      name: settings.from_name ?? readString(input.context, 'org', 'name') ?? VENDEPRO_BRAND.name,
      logoUrl: readString(input.context, 'org', 'logo_url'),
      color: readString(input.context, 'org', 'brand_color'),
      accentColor: VENDEPRO_BRAND.accentColor,
    }

    // Email al equipo: sin lista de bajas ni link de desuscripción — es
    // operativo, no comercial, y el destinatario es un usuario de la org.
    for (const to of recipients) {
      await this.email.send({
        from: { email: settings.from_email, name: settings.from_name ?? 'VendéPro' },
        to: { email: to.email, name: to.name ?? to.email },
        subject,
        html: renderEmailHtml({ brand, contentHtml: content, unsubscribeUrl: null }),
        text: renderEmailText({ brand, contentText: htmlToText(content), unsubscribeUrl: null }),
        tags: { kind: 'automation_internal', automation_id: input.automationId },
        // Un reintento del job no re-manda a quien ya le salió.
        idempotencyKey: `automation-internal:${input.runId}:${to.email}`,
      })
    }

    return { status: 'success', result: { notified: recipients.length, to: recipients.map((r) => r.email) } }
  }

  private async resolveRecipients(
    input: ActionExecutionInput,
  ): Promise<Array<{ email: string; name: string | null }>> {
    const target = String(input.config.target ?? 'assigned_agent')

    if (target === 'fixed') {
      const email = String(input.config.email ?? '').trim().toLowerCase()
      return email ? [{ email, name: null }] : []
    }

    if (target === 'admins') {
      const users = await this.users.findByOrg(input.orgId)
      return users
        .filter((u) => (u.role === 'admin' || u.role === 'owner') && u.active && u.email)
        .map((u) => ({ email: u.email as string, name: u.full_name ?? null }))
    }

    const email = readString(input.context, 'agent', 'email')
    const name = readString(input.context, 'agent', 'full_name')
    return email ? [{ email: email.toLowerCase(), name }] : []
  }
}

// ── assign_lead ───────────────────────────────────────────────

export class AssignLeadActionExecutor implements AutomationActionExecutor {
  readonly type = 'assign_lead'

  constructor(
    private readonly leads: LeadRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    const leadId = readString(input.context, 'lead', 'id')
    if (!leadId) return { status: 'skipped', reason: 'no_lead' }

    const lead = await this.leads.findById(leadId, input.orgId)
    if (!lead) return { status: 'skipped', reason: 'no_lead' }

    // Default true: la receta típica es "lead de portal sin dueño"; pisar una
    // asignación hecha a mano necesita opt-out explícito.
    if (input.config.only_if_unassigned !== false && lead.assigned_to) {
      return { status: 'skipped', reason: 'already_assigned' }
    }

    const chosen = await this.pickAgent(input)
    if (!chosen) return { status: 'skipped', reason: 'no_recipient' }

    lead.update({ assigned_to: chosen })
    await this.leads.save(lead)

    return { status: 'success', result: { lead_id: leadId, assigned_to: chosen } }
  }

  private async pickAgent(input: ActionExecutionInput): Promise<string | null> {
    const mode = String(input.config.mode ?? 'round_robin')
    const users = await this.users.findByOrg(input.orgId)
    const active = users.filter((u) => u.active && ['agent', 'admin', 'owner'].includes(u.role))

    if (mode === 'specific_user') {
      const userId = String(input.config.user_id ?? '').trim()
      return active.some((u) => u.id === userId) ? userId : null
    }

    if (active.length === 0) return null

    // "Round-robin" sin estado: le toca al agente activo con menos leads
    // abiertos. Converge a lo mismo que un turno rotativo y no necesita
    // recordar a quién le tocó la última vez.
    const openByAgent = new Map<string, number>()
    const allLeads = await this.leads.findByOrg(input.orgId)
    const CLOSED = new Set(['captado', 'perdido', 'archivado', 'finalizado'])
    for (const l of allLeads) {
      if (l.assigned_to && !CLOSED.has(l.stage)) {
        openByAgent.set(l.assigned_to, (openByAgent.get(l.assigned_to) ?? 0) + 1)
      }
    }

    const sorted = [...active].sort(
      (a, b) => (openByAgent.get(a.id) ?? 0) - (openByAgent.get(b.id) ?? 0) || a.id.localeCompare(b.id),
    )
    return sorted[0]?.id ?? null
  }
}

// ── add_tag ───────────────────────────────────────────────────

const NEW_TAG_COLOR = '#6b7280'

export class AddTagActionExecutor implements AutomationActionExecutor {
  readonly type = 'add_tag'

  constructor(
    private readonly tags: TagRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    // Las etiquetas cuelgan del lead (lead_tags); un evento sin lead no tiene
    // dónde ponerlas.
    const leadId = readString(input.context, 'lead', 'id')
    if (!leadId) return { status: 'skipped', reason: 'no_lead' }

    const names = normalizeTagNames(input.config.tags)
    if (names.length === 0) return { status: 'skipped', reason: 'empty_content' }

    const applied: string[] = []
    for (const name of names) {
      // Find-or-create por nombre: la config guarda nombres, no ids, para que
      // la receta sobreviva a que alguien borre y recree la etiqueta.
      let tag = await this.tags.findByName(input.orgId, name)
      if (!tag) {
        tag = Tag.create({
          id: this.ids.generate(),
          org_id: input.orgId,
          name,
          color: NEW_TAG_COLOR,
          is_default: 0,
        })
        await this.tags.save(tag)
      }
      // addToLead es INSERT OR IGNORE: re-etiquetar es idempotente.
      await this.tags.addToLead(leadId, tag.id, input.orgId)
      applied.push(name)
    }

    return { status: 'success', result: { lead_id: leadId, tags: applied } }
  }
}

function normalizeTagNames(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const name = String(item ?? '').trim()
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      out.push(name)
    }
  }
  return out
}

// ── send_webhook ──────────────────────────────────────────────

export class SendWebhookActionExecutor implements AutomationActionExecutor {
  readonly type = 'send_webhook'

  constructor(private readonly sender: WebhookSender) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    const url = String(input.config.url ?? '').trim()
    if (!/^https?:\/\//i.test(url)) return { status: 'skipped', reason: 'invalid_url' }

    // El secret firma con el mismo esquema que los webhooks salientes (032):
    // X-VendePro-Signature: sha256=HMAC(secret, body). Sin secret igual se
    // firma (con clave vacía); el receptor decide si valida.
    const secret = String(input.config.secret ?? '')

    const { __depth, ...context } = input.context as Record<string, unknown>
    const body = JSON.stringify({
      event: 'automation.action',
      org_id: input.orgId,
      automation_id: input.automationId,
      run_id: input.runId,
      context,
    })

    const result = await this.sender.send(url, secret, body)
    // Un HTTP no-2xx o un timeout ameritan reintento: es el mismo criterio que
    // el despachador de webhooks salientes.
    if (!result.ok) throw new Error(`webhook ${result.status ?? ''} ${result.error ?? ''}`.trim())

    return { status: 'success', result: { url, http_status: result.status } }
  }
}

// ── change_stage ──────────────────────────────────────────────

/**
 * Re-dispara el ciclo de eventos tras un cambio de etapa exitoso, con depth+1
 * para que el motor corte el encadenamiento. Se inyecta como función (igual
 * que CalendarMirror) para no acoplar este módulo a la factory.
 */
export type ChainEventDispatcher = (event: {
  orgId: string
  trigger: string
  entityType: 'lead' | 'property'
  entityId: string
  stage: { from: string | null; to: string }
  depth: number
}) => Promise<unknown>

export class ChangeStageActionExecutor implements AutomationActionExecutor {
  readonly type = 'change_stage'

  constructor(
    private readonly advanceLead: AdvanceLeadStageUseCase,
    private readonly updatePropertyStage: UpdatePropertyStageUseCase,
    private readonly chain?: ChainEventDispatcher,
  ) {}

  async execute(input: ActionExecutionInput): Promise<ActionOutcome> {
    const toStage = String(input.config.to_stage ?? '').trim()
    if (!toStage) return { status: 'skipped', reason: 'empty_content' }

    // La entidad sale del contexto del evento: el builder sólo carga `lead` o
    // `property` según el trigger, así que no hay ambigüedad.
    const leadId = readString(input.context, 'lead', 'id')
    const propertyId = leadId ? null : readString(input.context, 'property', 'id')
    if (!leadId && !propertyId) return { status: 'skipped', reason: 'no_entity' }

    // stage_history.changed_by: el agente del contexto, o la marca del motor.
    const changedBy = readString(input.context, 'agent', 'id') ?? 'automation'
    const depth = Number((input.context as Record<string, unknown>).__depth ?? 0)

    try {
      if (leadId) {
        const out = await this.advanceLead.execute({
          leadId, orgId: input.orgId, newStage: toStage as never, changedBy,
          notes: String(input.config.notes ?? '') || 'Cambio automático',
        })
        await this.dispatchChain('lead', leadId, out.fromStage, toStage, input.orgId, depth)
        return { status: 'success', result: { lead_id: leadId, from: out.fromStage, to: toStage } }
      }

      const out = await this.updatePropertyStage.execute({
        propertyId: propertyId!, orgId: input.orgId, newStage: toStage as never, changedBy,
        notes: String(input.config.notes ?? '') || 'Cambio automático',
      })
      await this.dispatchChain('property', propertyId!, out.fromStage, toStage, input.orgId, depth)
      return { status: 'success', result: { property_id: propertyId, from: out.fromStage, to: toStage } }
    } catch (err) {
      // Transición inválida o entidad borrada = problema de datos, no de
      // infraestructura: reintentar daría lo mismo. Queda como skipped con el
      // motivo a la vista.
      if (err instanceof ValidationError || err instanceof NotFoundError) {
        return { status: 'skipped', reason: `invalid_transition: ${(err as Error).message}` }
      }
      throw err
    }
  }

  private async dispatchChain(
    entityType: 'lead' | 'property',
    entityId: string,
    from: string | null,
    to: string,
    orgId: string,
    depth: number,
  ): Promise<void> {
    if (!this.chain) return
    try {
      await this.chain({
        orgId,
        trigger: `${entityType}.stage_changed`,
        entityType,
        entityId,
        stage: { from, to },
        depth: depth + 1,
      })
    } catch {
      // El encadenamiento es un extra: la etapa ya cambió, y eso era la acción.
    }
  }
}
