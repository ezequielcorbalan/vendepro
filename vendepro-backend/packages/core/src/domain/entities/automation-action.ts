import { ValidationError } from '../errors/validation-error'
import { getActionDefinition, type AutomationActionType } from '../value-objects/automation-catalog'

/**
 * Tope del delay: 180 días. Una secuencia de nurture inmobiliario
 * (un propietario que todavía no decide vender) se estira meses, así que
 * 30 días quedaba corto. El techo existe igual porque el contexto va
 * congelado desde el disparo: más allá de eso los datos ya no representan
 * al lead.
 */
export const MAX_DELAY_MINUTES = 180 * 24 * 60

export interface AutomationActionProps {
  id: string
  automation_id: string
  /** NULL en las acciones de las recetas del catálogo. */
  org_id: string | null
  order_index: number
  action_type: AutomationActionType
  action_config: Record<string, unknown>
  /** 0 = inmediata. >0 = la ejecuta el cron cuando vence. */
  delay_minutes: number
  created_at: string
  updated_at: string
}

export class AutomationAction {
  private constructor(private props: AutomationActionProps) {}

  static create(
    props: Omit<AutomationActionProps, 'created_at' | 'updated_at' | 'action_config'> & {
      created_at?: string
      updated_at?: string
      action_config?: unknown
    },
  ): AutomationAction {
    // Lanza si la acción no existe en el catálogo.
    const def = getActionDefinition(props.action_type)

    const action_config = normalizeConfig(props.action_config)
    for (const field of def.config_fields) {
      if (field.required && isBlank(action_config[field.name])) {
        throw new ValidationError(`"${def.label}": falta completar "${field.label}"`, {
          action_config: 'Incompleto',
        })
      }
    }

    const delay = Number(props.delay_minutes ?? 0)
    if (!Number.isFinite(delay) || delay < 0) {
      throw new ValidationError('La espera debe ser un número de minutos ≥ 0', { delay_minutes: 'Inválido' })
    }
    if (delay > MAX_DELAY_MINUTES) {
      throw new ValidationError('La espera no puede superar los 180 días', { delay_minutes: 'Fuera de rango' })
    }

    const now = new Date().toISOString()
    return new AutomationAction({
      ...props,
      org_id: props.org_id ?? null,
      order_index: Number.isFinite(props.order_index) ? props.order_index : 0,
      action_config,
      delay_minutes: Math.round(delay),
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  // ── Getters ──────────────────────────────────────────
  get id() { return this.props.id }
  get automation_id() { return this.props.automation_id }
  get org_id() { return this.props.org_id }
  get order_index() { return this.props.order_index }
  get action_type() { return this.props.action_type }
  get action_config() { return this.props.action_config }
  get delay_minutes() { return this.props.delay_minutes }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  // ── Domain Methods ──────────────────────────────────
  get is_immediate(): boolean {
    return this.props.delay_minutes === 0
  }

  /** ¿Está implementada en esta fase? Las que no, se registran como `skipped`. */
  get is_implemented(): boolean {
    return getActionDefinition(this.props.action_type).implemented
  }

  config<T = unknown>(key: string, fallback?: T): T {
    const value = this.props.action_config[key]
    return (value === undefined || value === null ? fallback : value) as T
  }

  configBool(key: string, fallback: boolean): boolean {
    const value = this.props.action_config[key]
    if (value === undefined || value === null || value === '') return fallback
    if (typeof value === 'boolean') return value
    return value === 1 || value === '1' || value === 'true'
  }

  /** Momento de ejecución dado el instante del disparo. */
  runAtFrom(triggeredAt: Date): string {
    return new Date(triggeredAt.getTime() + this.props.delay_minutes * 60_000).toISOString()
  }

  toObject(): AutomationActionProps {
    return { ...this.props, action_config: { ...this.props.action_config } }
  }
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
      throw new ValidationError('La configuración de la acción no es JSON válido', {
        action_config: 'Inválido',
      })
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) }
  return {}
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}
