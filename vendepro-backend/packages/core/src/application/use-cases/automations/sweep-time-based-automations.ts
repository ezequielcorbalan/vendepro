import type {
  AutomationRepository,
  AutomationSweepRepository,
} from '../../ports/repositories/automation-repository'
import type { Automation } from '../../../domain/entities/automation'
import type { EntityType } from '../../../domain/value-objects/automation-catalog'

/**
 * Candidatos por automatización por pasada. Acota el burst de la primera
 * corrida (una org que activa "lead frío" con 300 leads viejos no dispara 300
 * notificaciones en un tick); el resto entra en los ticks siguientes porque el
 * filtro anti-re-disparo va sacando a los ya procesados.
 */
export const SWEEP_CANDIDATES_LIMIT = 50

export interface SweepEvent {
  orgId: string
  trigger: string
  entityType: EntityType
  entityId: string
}

/**
 * El barrido no ejecuta acciones ni conoce el motor: despacha eventos como si
 * la entidad los hubiera emitido. Infraestructura lo wirea a
 * `fireAutomationEvent`, que arma el contexto y encola con dedupe.
 */
export type SweepEventDispatcher = (event: SweepEvent) => Promise<unknown>

export interface SweepTimeBasedAutomationsInput {
  now?: Date
  limitPerAutomation?: number
}

export interface SweepTimeBasedAutomationsOutput {
  /** Automatizaciones time-based activas evaluadas (todas las orgs). */
  automations: number
  /** Eventos despachados (candidatos encontrados). */
  dispatched: number
}

/**
 * Barrido del cron para los triggers por tiempo ('lead.sin_contacto_24h',
 * 'lead.sin_respuesta_7d', 'property.publicacion_vencida'): son los únicos del
 * catálogo que ningún request puede emitir, porque el hecho que los dispara es
 * el paso del tiempo.
 *
 * Por cada automatización activa busca las entidades que cruzaron su umbral y
 * despacha un evento por cada una. La deduplicación es doble: el filtro SQL
 * `notRunSince` evita re-evaluar candidatos ya procesados, y el `claim()` del
 * motor (índice único sobre dedupe_key) es la garantía final contra carreras.
 *
 * Una automatización mal configurada no puede frenar a las demás: cada una se
 * aísla y el error queda logueado.
 */
export class SweepTimeBasedAutomationsUseCase {
  constructor(
    private readonly automations: AutomationRepository,
    private readonly candidates: AutomationSweepRepository,
    private readonly dispatch: SweepEventDispatcher,
  ) {}

  async execute(input: SweepTimeBasedAutomationsInput = {}): Promise<SweepTimeBasedAutomationsOutput> {
    const now = input.now ?? new Date()
    const limit = input.limitPerAutomation ?? SWEEP_CANDIDATES_LIMIT

    const active = await this.automations.findActiveTimeBased()
    let dispatched = 0

    for (const { automation } of active) {
      if (!automation.org_id) continue // las recetas de sistema no corren solas
      try {
        const ids = await this.findCandidates(automation, now, limit)
        for (const entityId of ids) {
          await this.dispatch({
            orgId: automation.org_id,
            trigger: automation.trigger_type,
            entityType: automation.entity_type,
            entityId,
          })
          dispatched += 1
        }
      } catch (err) {
        console.error(
          `[automations] sweep de "${automation.name}" (${automation.id}) falló (aislado):`,
          (err as Error)?.message ?? err,
        )
      }
    }

    return { automations: active.length, dispatched }
  }

  private findCandidates(automation: Automation, now: Date, limit: number): Promise<string[]> {
    const base = {
      orgId: automation.org_id!,
      automationId: automation.id,
      notRunSince: notRunSinceFor(automation, now),
      limit,
    }

    switch (automation.trigger_type) {
      case 'lead.sin_contacto_24h': {
        const horas = automation.thresholdOr('horas', 24)
        return this.candidates.leadsSinContacto({
          ...base,
          createdBefore: sqliteUtc(new Date(now.getTime() - horas * 3_600_000)),
        })
      }
      case 'lead.sin_respuesta_7d': {
        const dias = automation.thresholdOr('dias', 7)
        return this.candidates.leadsSinRespuesta({
          ...base,
          inactiveSince: sqliteUtc(new Date(now.getTime() - dias * 86_400_000)),
        })
      }
      case 'property.publicacion_vencida': {
        return this.candidates.propiedadesPorVencer({
          ...base,
          hoy: ymd(now),
          diasAntes: automation.thresholdOr('dias_antes', 7),
        })
      }
      default:
        // findActiveTimeBased no debería devolver otros triggers; si el
        // catálogo suma uno, se agrega su query acá.
        return Promise.resolve([])
    }
  }
}

/**
 * Piso del filtro anti-re-disparo, alineado con el dedupe_key del motor:
 * 'once' excluye si corrió alguna vez; 'daily' si corrió hoy (día UTC, igual
 * que la clave). 'always' no tiene clave, así que este piso diario es la única
 * guarda — sin él, un tick cada 15 minutos son 96 disparos por día.
 */
function notRunSinceFor(automation: Automation, now: Date): string | null {
  return automation.dedupe_scope === 'once' ? null : ymd(now)
}

/** 'YYYY-MM-DD' en UTC — mismo día que usa AutomationRun.dedupeKey. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * 'YYYY-MM-DD HH:MM:SS' UTC, el formato de datetime('now') de SQLite. Las
 * queries igual normalizan ambos lados con datetime() porque en la base
 * conviven filas con este formato y filas ISO con 'T'/'Z'.
 */
function sqliteUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}
