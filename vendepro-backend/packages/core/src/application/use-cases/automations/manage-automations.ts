import type {
  AutomationRepository,
  AutomationRunRepository,
  AutomationJobRepository,
  AutomationWithActions,
  RunStats,
  RunListFilters,
} from '../../ports/repositories/automation-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Automation } from '../../../domain/entities/automation'
import { AutomationAction } from '../../../domain/entities/automation-action'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import {
  TRIGGER_DEFINITIONS,
  ACTION_DEFINITIONS,
  CONDITION_OPERATORS,
  OPERATOR_LABELS,
  UNARY_OPERATORS,
  VARIABLE_DEFINITIONS,
  getTriggerDefinition,
  variablesForTrigger,
  type AutomationTrigger,
} from '../../../domain/value-objects/automation-catalog'
import { LEAD_STAGES } from '../../../domain/value-objects/lead-stage'
import { PROPERTY_STAGES } from '../../../domain/value-objects/property-stage'
import { unknownTokens } from '../../../domain/rules/automation-interpolation'
import { DEDUPE_SCOPES } from '../../../domain/entities/automation-run'

/** Vista de lista: la automatización con sus contadores de ejecución. */
export interface AutomationListItem {
  automation: ReturnType<Automation['toObject']>
  actions: ReturnType<AutomationAction['toObject']>[]
  stats: Omit<RunStats, 'automation_id'>
}

const EMPTY_STATS = { total: 0, success: 0, failed: 0, skipped: 0, last_run_at: null }

// ── Listar ────────────────────────────────────────────────────

export class ListAutomationsUseCase {
  constructor(
    private readonly repo: AutomationRepository,
    private readonly runs: AutomationRunRepository,
  ) {}

  async execute(orgId: string): Promise<AutomationListItem[]> {
    const [items, stats] = await Promise.all([
      this.repo.findByOrg(orgId),
      this.runs.statsByOrg(orgId),
    ])
    const byId = new Map(stats.map((s) => [s.automation_id, s]))
    return items.map((item) => toListItem(item, byId.get(item.automation.id)))
  }
}

function toListItem(item: AutomationWithActions, stats?: RunStats): AutomationListItem {
  const { automation_id: _ignored, ...rest } = stats ?? { automation_id: '', ...EMPTY_STATS }
  return {
    automation: item.automation.toObject(),
    actions: item.actions.map((a) => a.toObject()),
    stats: rest,
  }
}

export class GetAutomationUseCase {
  constructor(private readonly repo: AutomationRepository) {}

  async execute(id: string, orgId: string): Promise<AutomationListItem> {
    const found = await this.repo.findById(id, orgId)
    if (!found) throw new NotFoundError('Automatización no encontrada')
    return toListItem(found)
  }
}

// ── Crear / editar ────────────────────────────────────────────

export interface ActionInput {
  id?: string
  action_type: string
  action_config?: unknown
  delay_minutes?: number
}

export interface SaveAutomationInput {
  /** Ausente → alta. Presente → edición. */
  id?: string
  orgId: string
  userId: string | null
  name: string
  description?: string | null
  trigger_type: string
  trigger_config?: unknown
  conditions?: unknown
  /** 'daily' (default) | 'once' (secuencias de bienvenida) | 'always'. */
  dedupe_scope?: string | null
  actions: ActionInput[]
  is_active?: boolean
}

export interface SaveAutomationOutput {
  id: string
  /** Variables usadas en los textos que no existen para este trigger. No bloquea. */
  warnings: string[]
}

export class SaveAutomationUseCase {
  constructor(
    private readonly repo: AutomationRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SaveAutomationInput): Promise<SaveAutomationOutput> {
    if (!Array.isArray(input.actions) || input.actions.length === 0) {
      throw new ValidationError('Agregá al menos una acción', { actions: 'Requerido' })
    }

    const existing = input.id ? await this.repo.findById(input.id, input.orgId) : null
    if (input.id && !existing) throw new NotFoundError('Automatización no encontrada')
    if (existing?.automation.is_system) {
      throw new ValidationError('Las recetas del catálogo no se editan: activala y editá tu copia')
    }

    const id = existing?.automation.id ?? this.ids.generate()
    const automation = Automation.create({
      id,
      org_id: input.orgId,
      name: input.name,
      description: input.description ?? null,
      template_key: existing?.automation.template_key ?? null,
      is_system: false,
      trigger_type: input.trigger_type as AutomationTrigger,
      trigger_config: input.trigger_config,
      conditions: input.conditions,
      dedupe_scope: input.dedupe_scope ?? existing?.automation.dedupe_scope,
      is_active: input.is_active ?? existing?.automation.is_active ?? false,
      created_by: existing?.automation.created_by ?? input.userId,
      created_at: existing?.automation.created_at,
    })

    const triggerDef = getTriggerDefinition(input.trigger_type)
    const actions = input.actions.map((a, index) =>
      AutomationAction.create({
        id: a.id ?? this.ids.generate(),
        automation_id: id,
        org_id: input.orgId,
        order_index: index,
        action_type: a.action_type as AutomationAction['action_type'],
        action_config: a.action_config,
        delay_minutes: a.delay_minutes ?? 0,
      }),
    )

    // La acción tiene que tener sentido para la entidad del trigger: no se
    // puede "asignar el lead" desde un evento de propiedad.
    for (const action of actions) {
      const def = ACTION_DEFINITIONS.find((d) => d.key === action.action_type)!
      if (!def.applies_to.includes(triggerDef.entity_type)) {
        throw new ValidationError(
          `"${def.label}" no aplica a un disparador de ${triggerDef.entity_type}`,
          { actions: 'Inválido' },
        )
      }
    }

    await this.repo.save(automation, actions)
    return { id, warnings: collectWarnings(input.trigger_type, actions) }
  }
}

/** Variables inexistentes en los textos. Advertencia, no error: renderizan vacío. */
function collectWarnings(triggerType: string, actions: readonly AutomationAction[]): string[] {
  const available = variablesForTrigger(triggerType).map((v) => v.key)
  const warnings = new Set<string>()
  for (const action of actions) {
    for (const value of Object.values(action.action_config)) {
      if (typeof value !== 'string') continue
      for (const token of unknownTokens(value, available)) {
        warnings.add(`La variable {{${token}}} no está disponible para este disparador y va a quedar vacía`)
      }
    }
  }
  return [...warnings]
}

// ── Activar / desactivar / borrar ─────────────────────────────

export class SetAutomationActiveUseCase {
  constructor(
    private readonly repo: AutomationRepository,
    private readonly jobs: AutomationJobRepository,
  ) {}

  async execute(input: { id: string; orgId: string; active: boolean }): Promise<void> {
    const found = await this.repo.findById(input.id, input.orgId)
    if (!found) throw new NotFoundError('Automatización no encontrada')

    await this.repo.setActive(input.id, input.orgId, input.active)
    // Apagarla no debe dejar mails diferidos en camino: se cancela lo pendiente.
    if (!input.active) {
      await this.jobs.cancelPendingByAutomation(input.id, 'automation_disabled')
    }
  }
}

export class DeleteAutomationUseCase {
  constructor(
    private readonly repo: AutomationRepository,
    private readonly jobs: AutomationJobRepository,
  ) {}

  async execute(id: string, orgId: string): Promise<void> {
    const found = await this.repo.findById(id, orgId)
    if (!found) throw new NotFoundError('Automatización no encontrada')
    await this.jobs.cancelPendingByAutomation(id, 'automation_deleted')
    await this.repo.delete(id, orgId)
  }
}

// ── Catálogo de recetas ───────────────────────────────────────

export interface CatalogItem {
  template_key: string
  name: string
  description: string | null
  trigger_type: string
  trigger_label: string
  action_labels: string[]
  /** true si la org ya la activó — el UI muestra "Ya activada". */
  activated: boolean
  /** false si alguna de sus acciones todavía no está implementada. */
  available: boolean
}

export class ListAutomationCatalogUseCase {
  constructor(private readonly repo: AutomationRepository) {}

  async execute(orgId: string): Promise<CatalogItem[]> {
    const [catalog, activated] = await Promise.all([
      this.repo.findSystemCatalog(),
      this.repo.findActivatedTemplateKeys(orgId),
    ])
    const already = new Set(activated)

    return catalog
      .filter((item) => item.automation.template_key)
      .map((item) => {
        const defs = item.actions.map(
          (a) => ACTION_DEFINITIONS.find((d) => d.key === a.action_type)!,
        )
        return {
          template_key: item.automation.template_key!,
          name: item.automation.name,
          description: item.automation.description,
          trigger_type: item.automation.trigger_type,
          trigger_label: getTriggerDefinition(item.automation.trigger_type).label,
          action_labels: defs.map((d) => d.label),
          activated: already.has(item.automation.template_key!),
          available: defs.every((d) => d.implemented),
        }
      })
  }
}

export class ActivateAutomationTemplateUseCase {
  constructor(
    private readonly repo: AutomationRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    templateKey: string
    orgId: string
    userId: string | null
    active?: boolean
  }): Promise<{ id: string }> {
    const template = await this.repo.findSystemByTemplateKey(input.templateKey)
    if (!template) throw new NotFoundError('Receta no encontrada en el catálogo')

    const activated = await this.repo.findActivatedTemplateKeys(input.orgId)
    if (activated.includes(input.templateKey)) {
      throw new ValidationError('Esta receta ya está activada en tu organización')
    }

    const id = this.ids.generate()
    const automation = template.automation.instantiateForOrg({
      id,
      orgId: input.orgId,
      createdBy: input.userId,
      active: input.active ?? true,
    })
    const actions = template.actions.map((a, index) =>
      AutomationAction.create({
        id: this.ids.generate(),
        automation_id: id,
        org_id: input.orgId,
        order_index: index,
        action_type: a.action_type,
        action_config: a.action_config,
        delay_minutes: a.delay_minutes,
      }),
    )

    await this.repo.save(automation, actions)
    return { id }
  }
}

// ── Metadatos para el editor ──────────────────────────────────

export interface AutomationsMeta {
  triggers: Array<
    ReturnType<typeof triggerMeta>
  >
  actions: typeof ACTION_DEFINITIONS
  operators: Array<{ value: string; label: string; unary: boolean }>
  variables: typeof VARIABLE_DEFINITIONS
  stages: { lead: readonly string[]; property: readonly string[] }
  dedupe_scopes: Array<{ value: string; label: string; help: string }>
}

function triggerMeta(def: (typeof TRIGGER_DEFINITIONS)[number]) {
  return {
    ...def,
    variables: variablesForTrigger(def.key).map((v) => v.key),
    /** Acciones válidas para la entidad de este trigger. */
    actions: ACTION_DEFINITIONS.filter((a) => a.applies_to.includes(def.entity_type)).map((a) => a.key),
  }
}

/**
 * Todo lo que el editor del frontend necesita para armarse solo. Es estático:
 * no toca la base, y evita duplicar el catálogo en el cliente.
 */
export class GetAutomationsMetaUseCase {
  execute(): AutomationsMeta {
    return {
      triggers: TRIGGER_DEFINITIONS.map(triggerMeta),
      actions: ACTION_DEFINITIONS,
      operators: CONDITION_OPERATORS.map((op) => ({
        value: op,
        label: OPERATOR_LABELS[op],
        unary: UNARY_OPERATORS.includes(op),
      })),
      variables: VARIABLE_DEFINITIONS,
      stages: { lead: LEAD_STAGES, property: PROPERTY_STAGES },
      dedupe_scopes: DEDUPE_SCOPE_LABELS,
    }
  }
}

const DEDUPE_SCOPE_LABELS = [
  { value: 'daily', label: 'Una vez por día', help: 'No se repite sobre la misma persona el mismo día.' },
  { value: 'once', label: 'Una sola vez', help: 'Nunca se repite. Es lo que corresponde a una secuencia de bienvenida.' },
  { value: 'always', label: 'Cada vez que pase', help: 'Se ejecuta en cada disparo, sin deduplicar. Usar con cuidado.' },
] as const satisfies ReadonlyArray<{ value: (typeof DEDUPE_SCOPES)[number]; label: string; help: string }>

// ── Log de ejecuciones ────────────────────────────────────────

export class ListAutomationRunsUseCase {
  constructor(private readonly runs: AutomationRunRepository) {}

  async execute(orgId: string, filters: RunListFilters = {}) {
    const runs = await this.runs.findByOrg(orgId, { limit: 50, ...filters })
    return Promise.all(
      runs.map(async (run) => ({
        ...run.toObject(),
        // El payload puede ser grande; en la lista sólo interesa el resumen.
        payload: undefined,
        actions: (await this.runs.findActionsByRun(run.id)).map((a) => a.toObject()),
      })),
    )
  }
}
