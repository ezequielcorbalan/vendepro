import type { Automation } from '../../../domain/entities/automation'
import type { AutomationAction } from '../../../domain/entities/automation-action'
import type { AutomationRun, AutomationRunAction } from '../../../domain/entities/automation-run'
import type { AutomationJob } from '../../../domain/entities/automation-job'

/** Automatización con sus acciones ya cargadas, ordenadas por order_index. */
export interface AutomationWithActions {
  automation: Automation
  actions: AutomationAction[]
}

export interface AutomationRepository {
  findById(id: string, orgId: string): Promise<AutomationWithActions | null>
  findByOrg(orgId: string): Promise<AutomationWithActions[]>

  /**
   * Lookup caliente del motor: automatizaciones activas de la org para un
   * trigger. Devuelve las acciones cargadas para evitar el N+1 por evento.
   */
  findActiveByTrigger(orgId: string, triggerType: string): Promise<AutomationWithActions[]>

  /** Recetas del catálogo (org_id NULL, is_system = 1). */
  findSystemCatalog(): Promise<AutomationWithActions[]>
  findSystemByTemplateKey(templateKey: string): Promise<AutomationWithActions | null>

  /** template_key de las recetas que la org ya activó — el catálogo las marca. */
  findActivatedTemplateKeys(orgId: string): Promise<string[]>

  /** Activas con trigger por tiempo, para el barrido del cron. */
  findActiveTimeBased(): Promise<AutomationWithActions[]>

  /** Guarda la automatización y reemplaza el set completo de acciones. */
  save(automation: Automation, actions: readonly AutomationAction[]): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  setActive(id: string, orgId: string, active: boolean): Promise<void>
}

export interface RunListFilters {
  automationId?: string
  status?: string
  entityId?: string
  limit?: number
}

/** Contadores para la lista del UI: cuántas veces corrió y cuántas fallaron. */
export interface RunStats {
  automation_id: string
  total: number
  success: number
  failed: number
  skipped: number
  last_run_at: string | null
}

export interface AutomationRunRepository {
  save(run: AutomationRun): Promise<void>
  findById(id: string, orgId: string): Promise<AutomationRun | null>
  findByOrg(orgId: string, filters?: RunListFilters): Promise<AutomationRun[]>

  /**
   * Inserta el run reservando su `dedupe_key`. Devuelve false si ya existía
   * uno con la misma clave — es la guarda anti-duplicado, resuelta por el
   * índice único en vez de por un SELECT previo (evita la carrera).
   */
  claim(run: AutomationRun): Promise<boolean>

  statsByOrg(orgId: string): Promise<RunStats[]>
  /** Runs de la org en las últimas N horas — alimenta el rate limit. */
  countSince(orgId: string, since: string): Promise<number>

  saveAction(action: AutomationRunAction): Promise<void>
  findActionsByRun(runId: string): Promise<AutomationRunAction[]>
}

// ── Barrido por tiempo ────────────────────────────────────────

/**
 * Parámetros comunes de las queries de candidatos del barrido.
 *
 * `automationId` + `notRunSince` implementan el filtro anti-re-disparo en SQL:
 * una entidad que ya tiene un run de esta automatización (desde `notRunSince`,
 * o desde siempre si es null) no vuelve a ser candidata. Sin este filtro el
 * cron re-evaluaría a los mismos leads en cada tick; el `claim()` del motor
 * los descartaría igual, pero pre-filtrar acá evita armar contexto al pedo y,
 * para el scope 'always', es la única guarda contra el spam cada 15 minutos.
 */
export interface SweepCandidateQuery {
  orgId: string
  automationId: string
  /** null = excluir si corrió alguna vez (scope 'once'); si no, desde cuándo. */
  notRunSince: string | null
  limit: number
}

export interface AutomationSweepRepository {
  /** Leads que siguen sin pasar a "contactado", creados antes del corte. */
  leadsSinContacto(q: SweepCandidateQuery & { createdBefore: string }): Promise<string[]>
  /** Leads abiertos sin actividad registrada desde el corte (o nunca). */
  leadsSinRespuesta(q: SweepCandidateQuery & { inactiveSince: string }): Promise<string[]>
  /** Propiedades activas cuya autorización vence dentro de `diasAntes` días. */
  propiedadesPorVencer(q: SweepCandidateQuery & { hoy: string; diasAntes: number }): Promise<string[]>
}

export interface AutomationJobRepository {
  save(job: AutomationJob): Promise<void>
  saveMany(jobs: readonly AutomationJob[]): Promise<void>
  findById(id: string): Promise<AutomationJob | null>

  /**
   * Jobs vencidos y sin lease vigente, más viejos primero.
   * `orgId` acota el drenaje inline al request en curso; sin él, barre todo
   * (lo que hace el cron).
   */
  findDue(limit: number, orgId?: string): Promise<AutomationJob[]>

  /** Jobs pendientes de un run — para saber si el run ya puede cerrarse. */
  countPendingByRun(runId: string): Promise<number>

  /** Cancela los jobs pendientes de una automatización que se apagó o borró. */
  cancelPendingByAutomation(automationId: string, reason: string): Promise<number>
}
