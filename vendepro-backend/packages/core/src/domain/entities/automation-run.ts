import type { EntityType } from '../value-objects/automation-catalog'

export type RunStatus = 'pending' | 'success' | 'partial' | 'failed' | 'skipped'

/** Cada cuánto una automatización puede volver a correr sobre la misma entidad. */
export const DEDUPE_SCOPES = ['daily', 'once', 'always'] as const
export type DedupeScope = (typeof DEDUPE_SCOPES)[number]

export type SkipReason =
  | 'conditions_not_met'
  | 'duplicate'
  | 'rate_limited'
  | 'suppressed'
  | 'max_depth'
  | 'no_recipient'
  | 'not_implemented'
  | 'email_disabled'

/** Profundidad máxima de encadenamiento. 1 = una automatización puede disparar
 *  otra, pero esa segunda ya no dispara una tercera. */
export const MAX_CHAIN_DEPTH = 1

export interface AutomationRunProps {
  id: string
  org_id: string
  automation_id: string
  trigger_event: string
  entity_type: EntityType | null
  entity_id: string | null
  status: RunStatus
  skip_reason: SkipReason | null
  payload: Record<string, unknown> | null
  depth: number
  dedupe_key: string | null
  started_at: string
  finished_at: string | null
  created_at: string
}

export class AutomationRun {
  private constructor(private props: AutomationRunProps) {}

  static create(
    props: Omit<AutomationRunProps, 'started_at' | 'created_at' | 'status' | 'skip_reason' | 'finished_at'> & {
      status?: RunStatus
      skip_reason?: SkipReason | null
      started_at?: string
      finished_at?: string | null
      created_at?: string
    },
  ): AutomationRun {
    const now = new Date().toISOString()
    return new AutomationRun({
      ...props,
      status: props.status ?? 'pending',
      skip_reason: props.skip_reason ?? null,
      payload: props.payload ?? null,
      depth: Number.isFinite(props.depth) ? props.depth : 0,
      dedupe_key: props.dedupe_key ?? null,
      started_at: props.started_at ?? now,
      finished_at: props.finished_at ?? null,
      created_at: props.created_at ?? now,
    })
  }

  /**
   * Clave de deduplicación, según el alcance configurado:
   *
   *   'daily'  → una vez por día. Evita que un lead reciba dos veces el mismo
   *              mail si el agente lo mueve de etapa y lo vuelve a mover.
   *   'once'   → una sola vez en la vida de la entidad. Es lo que necesita una
   *              secuencia de bienvenida: nadie se re-inscribe nunca.
   *   'always' → sin clave, por lo tanto sin deduplicación.
   */
  static dedupeKey(args: {
    automationId: string
    entityId: string | null
    triggerEvent: string
    scope?: DedupeScope
    at?: Date
  }): string | null {
    const scope = args.scope ?? 'daily'
    if (scope === 'always' || !args.entityId) return null

    const base = `${args.automationId}:${args.entityId}:${args.triggerEvent}`
    if (scope === 'once') return base

    const d = args.at ?? new Date()
    const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
    return `${base}:${ymd}`
  }

  // ── Getters ──────────────────────────────────────────
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get automation_id() { return this.props.automation_id }
  get trigger_event() { return this.props.trigger_event }
  get entity_type() { return this.props.entity_type }
  get entity_id() { return this.props.entity_id }
  get status() { return this.props.status }
  get skip_reason() { return this.props.skip_reason }
  get payload() { return this.props.payload }
  get depth() { return this.props.depth }
  get dedupe_key() { return this.props.dedupe_key }
  get started_at() { return this.props.started_at }
  get finished_at() { return this.props.finished_at }
  get created_at() { return this.props.created_at }

  // ── Domain Methods ──────────────────────────────────
  /** ¿Las acciones de este run pueden disparar nuevos eventos? */
  get canChain(): boolean {
    return this.props.depth < MAX_CHAIN_DEPTH
  }

  markSkipped(reason: SkipReason): void {
    this.props.status = 'skipped'
    this.props.skip_reason = reason
    this.props.finished_at = new Date().toISOString()
  }

  /** Cierra el run según cómo terminó cada acción. */
  settle(results: readonly { status: 'success' | 'failed' | 'skipped' | 'pending' }[]): void {
    // Con acciones diferidas todavía pendientes el run sigue abierto: lo cierra
    // el drenaje del último job.
    if (results.some((r) => r.status === 'pending')) {
      this.props.status = 'pending'
      return
    }
    const failed = results.filter((r) => r.status === 'failed').length
    const succeeded = results.filter((r) => r.status === 'success').length
    if (failed === 0) this.props.status = 'success'
    else if (succeeded > 0) this.props.status = 'partial'
    else this.props.status = 'failed'
    this.props.finished_at = new Date().toISOString()
  }

  toObject(): AutomationRunProps {
    return { ...this.props }
  }
}

// ── Resultado por acción ──────────────────────────────────────

export type RunActionStatus = 'pending' | 'success' | 'failed' | 'skipped'

export interface AutomationRunActionProps {
  id: string
  run_id: string
  org_id: string
  action_id: string
  action_type: string
  status: RunActionStatus
  /** Detalle para el UI: a quién se le mandó el mail, qué evento se creó. */
  result: Record<string, unknown> | null
  error: string | null
  executed_at: string | null
  created_at: string
}

export class AutomationRunAction {
  private constructor(private props: AutomationRunActionProps) {}

  static create(
    props: Omit<AutomationRunActionProps, 'created_at' | 'status' | 'result' | 'error' | 'executed_at'> & {
      status?: RunActionStatus
      result?: Record<string, unknown> | null
      error?: string | null
      executed_at?: string | null
      created_at?: string
    },
  ): AutomationRunAction {
    return new AutomationRunAction({
      ...props,
      status: props.status ?? 'pending',
      result: props.result ?? null,
      error: props.error ?? null,
      executed_at: props.executed_at ?? null,
      created_at: props.created_at ?? new Date().toISOString(),
    })
  }

  get id() { return this.props.id }
  get run_id() { return this.props.run_id }
  get org_id() { return this.props.org_id }
  get action_id() { return this.props.action_id }
  get action_type() { return this.props.action_type }
  get status() { return this.props.status }
  get result() { return this.props.result }
  get error() { return this.props.error }
  get executed_at() { return this.props.executed_at }
  get created_at() { return this.props.created_at }

  markSuccess(result?: Record<string, unknown>): void {
    this.props.status = 'success'
    this.props.result = result ?? null
    this.props.error = null
    this.props.executed_at = new Date().toISOString()
  }

  markFailed(error: string): void {
    this.props.status = 'failed'
    this.props.error = error.slice(0, 2000)
    this.props.executed_at = new Date().toISOString()
  }

  markSkipped(reason: string): void {
    this.props.status = 'skipped'
    this.props.error = reason.slice(0, 2000)
    this.props.executed_at = new Date().toISOString()
  }

  toObject(): AutomationRunActionProps {
    return { ...this.props }
  }
}
