import type {
  AutomationRunRepository,
  AutomationJobRepository,
} from '../../ports/repositories/automation-repository'
import type { AutomationExecutorRegistry } from '../../ports/services/automation-action-executor'
import type { AutomationJob } from '../../../domain/entities/automation-job'
import type { AutomationRunAction } from '../../../domain/entities/automation-run'
import type { AutomationContext } from '../../../domain/rules/automation-conditions'
import { interpolate } from '../../../domain/rules/automation-interpolation'

/** Jobs por pasada. Acotado para no pasarse de los límites de CPU del Worker. */
export const DEFAULT_DRAIN_LIMIT = 25

export interface DrainAutomationJobsInput {
  /** Acota el drenaje a una org — es lo que hace el drenaje inline del request. */
  orgId?: string
  limit?: number
  now?: Date
}

export interface DrainAutomationJobsOutput {
  processed: number
  succeeded: number
  failed: number
  skipped: number
}

/**
 * Ejecuta los jobs vencidos de la cola.
 *
 * Lo llaman dos lados: `ctx.waitUntil` justo después de disparar un evento
 * (latencia ~0 para las acciones inmediatas) y el cron de api-crm cada 15
 * minutos (ejecuta los diferidos y recupera lo que el inline no pudo).
 *
 * Ningún job puede tumbar la pasada: cada uno se aísla y se contabiliza.
 */
export class DrainAutomationJobsUseCase {
  constructor(
    private readonly jobs: AutomationJobRepository,
    private readonly runs: AutomationRunRepository,
    private readonly registry: AutomationExecutorRegistry,
  ) {}

  async execute(input: DrainAutomationJobsInput = {}): Promise<DrainAutomationJobsOutput> {
    const now = input.now ?? new Date()
    const due = await this.jobs.findDue(input.limit ?? DEFAULT_DRAIN_LIMIT, input.orgId)

    const out: DrainAutomationJobsOutput = { processed: 0, succeeded: 0, failed: 0, skipped: 0 }
    for (const job of due) {
      const result = await this.runOne(job, now)
      out.processed += 1
      out[result] += 1
    }
    return out
  }

  private async runOne(job: AutomationJob, now: Date): Promise<'succeeded' | 'failed' | 'skipped'> {
    // Tomar el lease antes de cualquier efecto: si dos drenajes concurrentes
    // llegan al mismo job, el segundo ya no lo ve como vencido.
    job.markRunning(now)
    await this.jobs.save(job)

    const runActions = await this.runs.findActionsByRun(job.run_id)
    const runAction = runActions.find((a) => a.id === job.run_action_id) ?? null

    try {
      const executor = this.registry.get(job.action_type)
      if (!executor) {
        // La acción existe en el catálogo pero no está implementada en este
        // worker. No es un error recuperable: se marca y se cierra.
        runAction?.markSkipped('not_implemented')
        job.markDone()
        await this.persist(job, runAction)
        return 'skipped'
      }

      const context = job.context as AutomationContext
      const outcome = await executor.execute({
        orgId: job.org_id,
        config: interpolateConfig(job.action_config, context),
        rawConfig: job.action_config,
        context,
        automationId: job.automation_id,
        runId: job.run_id,
      })

      if (outcome.status === 'skipped') runAction?.markSkipped(outcome.reason)
      else runAction?.markSuccess(outcome.result)

      job.markDone()
      await this.persist(job, runAction)
      return outcome.status === 'skipped' ? 'skipped' : 'succeeded'
    } catch (err) {
      const message = (err as Error)?.message ?? String(err)
      job.markAttemptFailed(message, now)
      // Mientras queden reintentos la acción sigue 'pending': el run no debe
      // cerrarse como fallido hasta que se agoten.
      if (job.status === 'failed') runAction?.markFailed(message)
      await this.persist(job, runAction)
      return 'failed'
    }
  }

  private async persist(job: AutomationJob, runAction: AutomationRunAction | null): Promise<void> {
    await this.jobs.save(job)
    if (runAction) await this.runs.saveAction(runAction)
    await this.settleRunIfDone(job.run_id, job.org_id)
  }

  /** Cierra el run cuando ya no le queda ningún job por ejecutar. */
  private async settleRunIfDone(runId: string, orgId: string): Promise<void> {
    const pending = await this.jobs.countPendingByRun(runId)
    if (pending > 0) return

    const run = await this.runs.findById(runId, orgId)
    if (!run || run.status !== 'pending') return

    const actions = await this.runs.findActionsByRun(runId)
    run.settle(actions.map((a) => ({ status: a.status })))
    await this.runs.save(run)
  }
}

/**
 * Interpola `{{variables}}` en todos los strings de la config.
 *
 * Los campos `*_html` se interpolan en modo HTML (el valor se escapa, porque
 * el nombre del lead lo carga un tercero desde un formulario público). El
 * resto va en texto plano.
 */
export function interpolateConfig(
  config: Record<string, unknown>,
  context: AutomationContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      out[key] = interpolate(value, context, { mode: key.endsWith('_html') ? 'html' : 'text' })
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => (typeof v === 'string' ? interpolate(v, context) : v))
    } else {
      out[key] = value
    }
  }
  return out
}
