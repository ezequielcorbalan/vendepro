import { ValidationError } from '../errors/validation-error'
import {
  getTriggerDefinition,
  isTimeBasedTrigger,
  type AutomationTrigger,
  type EntityType,
} from '../value-objects/automation-catalog'
import { parseConditions, type AutomationCondition } from '../rules/automation-conditions'
import { DEDUPE_SCOPES, type DedupeScope } from './automation-run'

export interface AutomationProps {
  id: string
  /** NULL sólo en las recetas del catálogo (is_system = 1). */
  org_id: string | null
  name: string
  description: string | null
  /** Clave de la receta de origen. Identifica a la automatización entre versiones del catálogo. */
  template_key: string | null
  is_system: boolean
  trigger_type: AutomationTrigger
  trigger_config: Record<string, unknown>
  conditions: AutomationCondition[]
  /** Cada cuánto puede repetirse sobre la misma entidad. Default 'daily'. */
  dedupe_scope: DedupeScope
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export class Automation {
  private constructor(private props: AutomationProps) {}

  static create(
    props: Omit<AutomationProps, 'created_at' | 'updated_at' | 'conditions' | 'trigger_config' | 'dedupe_scope'> & {
      created_at?: string
      updated_at?: string
      conditions?: unknown
      trigger_config?: unknown
      dedupe_scope?: string | null
    },
  ): Automation {
    const name = (props.name ?? '').trim()
    if (name.length < 2) {
      throw new ValidationError('El nombre de la automatización es requerido (mín. 2 caracteres)', {
        name: 'Requerido',
      })
    }
    // Lanza si el trigger no existe en el catálogo.
    const trigger = getTriggerDefinition(props.trigger_type)

    if (!props.is_system && !props.org_id) {
      throw new ValidationError('Una automatización de org requiere org_id', { org_id: 'Requerido' })
    }

    const trigger_config = normalizeConfig(props.trigger_config)
    for (const field of trigger.config_fields) {
      if (field.required && isBlank(trigger_config[field.name])) {
        // `to_stage` se documenta como opcional en la ayuda del campo: vacío
        // significa "cualquier etapa". El resto de los requeridos sí se exigen.
        if (field.name === 'to_stage') continue
        throw new ValidationError(`Falta "${field.label}" en la configuración del disparador`, {
          trigger_config: 'Incompleto',
        })
      }
    }

    const now = new Date().toISOString()
    return new Automation({
      ...props,
      name,
      description: props.description?.trim() || null,
      template_key: props.template_key?.trim() || null,
      org_id: props.org_id ?? null,
      trigger_config,
      conditions: parseConditions(props.conditions),
      dedupe_scope: normalizeDedupeScope(props.dedupe_scope),
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  // ── Getters ──────────────────────────────────────────
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get description() { return this.props.description }
  get template_key() { return this.props.template_key }
  get is_system() { return this.props.is_system }
  get trigger_type() { return this.props.trigger_type }
  get trigger_config() { return this.props.trigger_config }
  get conditions() { return this.props.conditions }
  get dedupe_scope() { return this.props.dedupe_scope }
  get is_active() { return this.props.is_active }
  get created_by() { return this.props.created_by }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  // ── Domain Methods ──────────────────────────────────
  get entity_type(): EntityType {
    return getTriggerDefinition(this.props.trigger_type).entity_type
  }

  get is_time_based(): boolean {
    return isTimeBasedTrigger(this.props.trigger_type)
  }

  /**
   * ¿El evento concreto coincide con el disparador configurado?
   * El filtro por trigger_type ya lo hizo la query; acá se chequea el detalle
   * (`to_stage`, `from_stage`) que vive en trigger_config.
   */
  matchesEvent(event: { to_stage?: string | null; from_stage?: string | null }): boolean {
    const cfg = this.props.trigger_config
    const wantedTo = asString(cfg.to_stage)
    if (wantedTo && asString(event.to_stage) !== wantedTo) return false
    const wantedFrom = asString(cfg.from_stage)
    if (wantedFrom && asString(event.from_stage) !== wantedFrom) return false
    return true
  }

  /** Número configurado en el trigger (horas / días), con default del catálogo. */
  thresholdOr(fieldName: string, fallback: number): number {
    const raw = this.props.trigger_config[fieldName]
    const n = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }

  activate(): Automation { return this.withChanges({ is_active: true }) }
  deactivate(): Automation { return this.withChanges({ is_active: false }) }

  update(changes: {
    name?: string
    description?: string | null
    trigger_type?: AutomationTrigger
    trigger_config?: unknown
    conditions?: unknown
    dedupe_scope?: string | null
    is_active?: boolean
  }): Automation {
    if (this.props.is_system) {
      throw new ValidationError('Las recetas del catálogo no se editan: activala en tu organización y editá esa copia')
    }
    return this.withChanges(changes)
  }

  /** Copia la receta del catálogo como automatización propia de la org. */
  instantiateForOrg(args: { id: string; orgId: string; createdBy: string | null; active?: boolean }): Automation {
    return Automation.create({
      ...this.props,
      id: args.id,
      org_id: args.orgId,
      is_system: false,
      is_active: args.active ?? true,
      created_by: args.createdBy,
      created_at: undefined,
      updated_at: undefined,
    })
  }

  private withChanges(changes: Partial<AutomationProps> & { trigger_config?: unknown; conditions?: unknown }): Automation {
    return Automation.create({
      ...this.props,
      ...changes,
      created_at: this.props.created_at,
      updated_at: new Date().toISOString(),
    })
  }

  toObject(): AutomationProps {
    return { ...this.props, trigger_config: { ...this.props.trigger_config }, conditions: [...this.props.conditions] }
  }
}

/** Un valor desconocido cae a 'daily': el default seguro es deduplicar. */
function normalizeDedupeScope(raw: unknown): DedupeScope {
  const value = typeof raw === 'string' ? raw.trim() : ''
  return (DEDUPE_SCOPES as readonly string[]).includes(value) ? (value as DedupeScope) : 'daily'
}

function normalizeConfig(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {}
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed.length === 0) return {}
    try {
      const parsed = JSON.parse(trimmed)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      throw new ValidationError('La configuración del disparador no es JSON válido', {
        trigger_config: 'Inválido',
      })
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) }
  return {}
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}
