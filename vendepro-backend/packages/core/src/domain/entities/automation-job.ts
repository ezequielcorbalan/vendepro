export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled'

/** Intentos antes de darlo por perdido. */
export const MAX_JOB_ATTEMPTS = 3
/** Duración del lease al tomar un job, para que el cron y el drenaje inline no lo dupliquen. */
export const JOB_LOCK_MINUTES = 5

export interface AutomationJobProps {
  id: string
  org_id: string
  run_id: string
  run_action_id: string
  automation_id: string
  action_id: string
  action_type: string
  /** Snapshot del contexto en el momento del disparo. Congelado a propósito. */
  context: Record<string, unknown>
  /**
   * Snapshot de la config de la acción. Se congela para que un job diferido no
   * falle si la automatización se editó o se borró mientras esperaba, y para
   * que el log refleje exactamente lo que se envió.
   */
  action_config: Record<string, unknown>
  run_at: string
  status: JobStatus
  attempts: number
  last_error: string | null
  locked_until: string | null
  created_at: string
  updated_at: string
}

export class AutomationJob {
  private constructor(private props: AutomationJobProps) {}

  static create(
    props: Omit<AutomationJobProps, 'status' | 'attempts' | 'last_error' | 'locked_until' | 'created_at' | 'updated_at'> & {
      status?: JobStatus
      attempts?: number
      last_error?: string | null
      locked_until?: string | null
      created_at?: string
      updated_at?: string
    },
  ): AutomationJob {
    const now = new Date().toISOString()
    return new AutomationJob({
      ...props,
      context: props.context ?? {},
      action_config: props.action_config ?? {},
      status: props.status ?? 'pending',
      attempts: props.attempts ?? 0,
      last_error: props.last_error ?? null,
      locked_until: props.locked_until ?? null,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  // ── Getters ──────────────────────────────────────────
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get run_id() { return this.props.run_id }
  get run_action_id() { return this.props.run_action_id }
  get automation_id() { return this.props.automation_id }
  get action_id() { return this.props.action_id }
  get action_type() { return this.props.action_type }
  get context() { return this.props.context }
  get action_config() { return this.props.action_config }
  get run_at() { return this.props.run_at }
  get status() { return this.props.status }
  get attempts() { return this.props.attempts }
  get last_error() { return this.props.last_error }
  get locked_until() { return this.props.locked_until }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  // ── Domain Methods ──────────────────────────────────
  isDue(now: Date = new Date()): boolean {
    return this.props.status === 'pending' && new Date(this.props.run_at).getTime() <= now.getTime()
  }

  get hasAttemptsLeft(): boolean {
    return this.props.attempts < MAX_JOB_ATTEMPTS
  }

  markRunning(now: Date = new Date()): void {
    this.props.status = 'running'
    this.props.attempts += 1
    this.props.locked_until = new Date(now.getTime() + JOB_LOCK_MINUTES * 60_000).toISOString()
    this.props.updated_at = now.toISOString()
  }

  markDone(): void {
    this.props.status = 'done'
    this.props.locked_until = null
    this.props.last_error = null
    this.props.updated_at = new Date().toISOString()
  }

  /**
   * Falla un intento. Mientras queden reintentos vuelve a 'pending' con backoff
   * exponencial (5' → 25' → …); agotados, queda 'failed' para inspección.
   */
  markAttemptFailed(error: string, now: Date = new Date()): void {
    this.props.last_error = error.slice(0, 2000)
    this.props.locked_until = null
    this.props.updated_at = now.toISOString()
    if (this.hasAttemptsLeft) {
      this.props.status = 'pending'
      this.props.run_at = new Date(now.getTime() + backoffMinutes(this.props.attempts) * 60_000).toISOString()
    } else {
      this.props.status = 'failed'
    }
  }

  cancel(reason: string): void {
    this.props.status = 'cancelled'
    this.props.last_error = reason.slice(0, 2000)
    this.props.locked_until = null
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): AutomationJobProps {
    return {
      ...this.props,
      context: { ...this.props.context },
      action_config: { ...this.props.action_config },
    }
  }
}

function backoffMinutes(attempts: number): number {
  return Math.min(5 ** attempts, 60)
}
