import type {
  AutomationRepository,
  AutomationRunRepository,
  AutomationJobRepository,
  AutomationWithActions,
} from '../../ports/repositories/automation-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { AutomationRun, AutomationRunAction, MAX_CHAIN_DEPTH } from '../../../domain/entities/automation-run'
import { AutomationJob } from '../../../domain/entities/automation-job'
import { evaluateConditions } from '../../../domain/rules/automation-conditions'
import type { AutomationContext } from '../../../domain/rules/automation-conditions'
import { actionChainsEvents, type EntityType } from '../../../domain/value-objects/automation-catalog'

/** Tope de runs por org por hora. Corta un bucle imprevisto antes de que se note en la factura. */
export const RUNS_PER_HOUR_LIMIT = 500

export interface RunAutomationsForEventInput {
  orgId: string
  /** Clave del trigger: 'lead.created', 'lead.stage_changed', … */
  trigger: string
  entityType: EntityType
  entityId: string
  /** Contexto ya armado: { lead, contact, property, agent, org, stage, now }. */
  context: AutomationContext
  /** Detalle del evento para el match del trigger. */
  event?: { to_stage?: string | null; from_stage?: string | null }
  /**
   * Profundidad de encadenamiento. 0 = lo disparó un usuario o el cron.
   * >= MAX_CHAIN_DEPTH → no se ejecuta nada (anti-loop).
   */
  depth?: number
  /** Momento del disparo. Inyectable para los tests. */
  now?: Date
}

export interface AutomationMatchResult {
  automation_id: string
  automation_name: string
  run_id: string | null
  status: 'queued' | 'skipped'
  skip_reason?: string
  jobs_queued: number
}

export interface RunAutomationsForEventOutput {
  /** Automatizaciones activas suscriptas a este trigger. */
  evaluated: number
  /** Cuántas quedaron encoladas para ejecutar. */
  queued: number
  results: AutomationMatchResult[]
}

/**
 * Núcleo del motor. Ante un evento del CRM:
 *
 *   1. busca las automatizaciones activas de la org suscriptas al trigger
 *   2. filtra por el detalle del trigger (`to_stage`) y por las condiciones
 *   3. reserva el run con su dedupe_key (falla → ya corrió hoy, se descarta)
 *   4. encola una fila en `automation_jobs` por acción
 *
 * NO ejecuta las acciones: eso lo hace `DrainAutomationJobsUseCase`. La
 * separación es deliberada — todo lo que se dispara queda persistido antes de
 * intentar cualquier efecto, así un worker que se evicta a mitad de camino no
 * pierde el envío y el reintento es gratis.
 */
export class RunAutomationsForEventUseCase {
  constructor(
    private readonly automations: AutomationRepository,
    private readonly runs: AutomationRunRepository,
    private readonly jobs: AutomationJobRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RunAutomationsForEventInput): Promise<RunAutomationsForEventOutput> {
    const depth = input.depth ?? 0
    const now = input.now ?? new Date()
    const empty: RunAutomationsForEventOutput = { evaluated: 0, queued: 0, results: [] }

    // Anti-loop: una acción `change_stage` dispara `lead.stage_changed`, que
    // podría volver a dispararla. A partir de MAX_CHAIN_DEPTH se corta seco.
    if (depth >= MAX_CHAIN_DEPTH) return empty

    const candidates = await this.automations.findActiveByTrigger(input.orgId, input.trigger)
    if (candidates.length === 0) return empty

    const overLimit = await this.isRateLimited(input.orgId, now)

    const results: AutomationMatchResult[] = []
    for (const candidate of candidates) {
      results.push(await this.processOne(candidate, input, depth, now, overLimit))
    }

    return {
      evaluated: candidates.length,
      queued: results.filter((r) => r.status === 'queued').length,
      results,
    }
  }

  private async processOne(
    candidate: AutomationWithActions,
    input: RunAutomationsForEventInput,
    depth: number,
    now: Date,
    overLimit: boolean,
  ): Promise<AutomationMatchResult> {
    const { automation, actions } = candidate
    const base = { automation_id: automation.id, automation_name: automation.name }

    // Filtros baratos primero — no se crea run para lo que ni siquiera aplica,
    // así el log queda limpio y legible para el cliente.
    if (!automation.matchesEvent(input.event ?? {})) {
      return { ...base, run_id: null, status: 'skipped', skip_reason: 'trigger_mismatch', jobs_queued: 0 }
    }
    if (!evaluateConditions(automation.conditions, input.context)) {
      return { ...base, run_id: null, status: 'skipped', skip_reason: 'conditions_not_met', jobs_queued: 0 }
    }
    if (actions.length === 0) {
      return { ...base, run_id: null, status: 'skipped', skip_reason: 'no_actions', jobs_queued: 0 }
    }

    const run = AutomationRun.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      automation_id: automation.id,
      trigger_event: input.trigger,
      entity_type: input.entityType,
      entity_id: input.entityId,
      payload: { event: input.event ?? {}, context: input.context },
      depth,
      dedupe_key: AutomationRun.dedupeKey({
        automationId: automation.id,
        entityId: input.entityId,
        triggerEvent: input.trigger,
        scope: automation.dedupe_scope,
        at: now,
      }),
      started_at: now.toISOString(),
    })

    if (overLimit) {
      run.markSkipped('rate_limited')
      await this.runs.save(run)
      return { ...base, run_id: run.id, status: 'skipped', skip_reason: 'rate_limited', jobs_queued: 0 }
    }

    // La reserva del dedupe_key la resuelve el índice único, no un SELECT
    // previo: dos requests simultáneos sobre el mismo lead no pueden ganar los dos.
    const claimed = await this.runs.claim(run)
    if (!claimed) {
      return { ...base, run_id: null, status: 'skipped', skip_reason: 'duplicate', jobs_queued: 0 }
    }

    const jobs: AutomationJob[] = []
    for (const action of actions) {
      const runAction = AutomationRunAction.create({
        id: this.ids.generate(),
        run_id: run.id,
        org_id: input.orgId,
        action_id: action.id,
        action_type: action.action_type,
      })

      // Una acción que encadena eventos sólo puede correr si el run todavía
      // tiene margen de profundidad; si no, se registra y se saltea.
      if (actionChainsEvents(action.action_type) && !run.canChain) {
        runAction.markSkipped('max_depth')
        await this.runs.saveAction(runAction)
        continue
      }

      await this.runs.saveAction(runAction)
      jobs.push(
        AutomationJob.create({
          id: this.ids.generate(),
          org_id: input.orgId,
          run_id: run.id,
          run_action_id: runAction.id,
          automation_id: automation.id,
          action_id: action.id,
          action_type: action.action_type,
          // El contexto se congela acá: si el lead cambia entre el disparo y un
          // envío diferido a 3 días, el mail usa los datos del momento del disparo.
          context: { ...input.context, __depth: depth },
          action_config: action.action_config,
          run_at: action.runAtFrom(now),
        }),
      )
    }

    if (jobs.length === 0) {
      run.markSkipped('max_depth')
      await this.runs.save(run)
      return { ...base, run_id: run.id, status: 'skipped', skip_reason: 'max_depth', jobs_queued: 0 }
    }

    await this.jobs.saveMany(jobs)
    return { ...base, run_id: run.id, status: 'queued', jobs_queued: jobs.length }
  }

  private async isRateLimited(orgId: string, now: Date): Promise<boolean> {
    const since = new Date(now.getTime() - 60 * 60_000).toISOString()
    try {
      return (await this.runs.countSince(orgId, since)) >= RUNS_PER_HOUR_LIMIT
    } catch {
      // El rate limit es una red de seguridad, no una precondición: si la
      // consulta falla no se bloquea el negocio.
      return false
    }
  }
}
