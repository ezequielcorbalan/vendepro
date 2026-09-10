import type { AutomationRepository } from '../../ports/repositories/automation-repository'
import type { TimeBasedCandidateRepository } from '../../ports/repositories/time-based-candidate-repository'
import type { BuildAutomationContextUseCase } from './build-automation-context'
import type { RunAutomationsForEventUseCase } from './run-automations-for-event'
import type { EntityType } from '../../../domain/value-objects/automation-catalog'

/** Tope de entidades por automatización por barrido. El resto entra en los
 *  ticks siguientes — el filtro por runs ya hechos garantiza que avanza. */
export const SWEEP_LIMIT_PER_AUTOMATION = 50

export interface SweepTimeBasedAutomationsOutput {
  /** Automatizaciones time-based activas encontradas. */
  automations: number
  /** Entidades evaluadas (candidatas que cumplían la condición). */
  entities: number
  /** Runs que quedaron encolados. */
  queued: number
}

/**
 * El barrido que hace correr los triggers time-based. El resto del motor es
 * por eventos (algo pasa → se dispara); "lleva 24h sin contactar" no tiene
 * evento — alguien tiene que mirar el reloj. Ese alguien es este use case,
 * colgado del cron de 15 minutos de api-crm.
 *
 * Por cada automatización activa con trigger time-based busca las entidades
 * que hoy cumplen la condición y las dispara por el mismo camino que
 * cualquier evento (`RunAutomationsForEventUseCase`), así valen las mismas
 * reglas: condiciones, rate limit por org y dedupe — las recetas de sistema
 * usan scope 'once', o sea que cada lead dispara la alerta una sola vez.
 *
 * Una automatización que falla no frena a las demás (multi-org: una org con
 * datos rotos no puede apagarle las alertas al resto).
 */
export class SweepTimeBasedAutomationsUseCase {
  constructor(
    private readonly automations: AutomationRepository,
    private readonly candidates: TimeBasedCandidateRepository,
    private readonly contextBuilder: BuildAutomationContextUseCase,
    private readonly runner: RunAutomationsForEventUseCase,
  ) {}

  async execute(opts: { now?: Date; limitPerAutomation?: number } = {}): Promise<SweepTimeBasedAutomationsOutput> {
    const now = opts.now ?? new Date()
    const limit = opts.limitPerAutomation ?? SWEEP_LIMIT_PER_AUTOMATION

    const active = await this.automations.findActiveTimeBased()
    const out: SweepTimeBasedAutomationsOutput = { automations: active.length, entities: 0, queued: 0 }

    for (const { automation } of active) {
      try {
        // Pre-filtro alineado con el dedupe del motor: 'once' no repite nunca;
        // 'daily' repite a partir del día UTC siguiente. 'always' no dedupea en
        // el claim, pero el barrido corre 96 veces por día — sin este corte un
        // 'always' dispararía en cada tick, así que se lo limita a 1/día.
        const notRunSince = automation.dedupe_scope === 'once' ? null : startOfUtcDay(now)
        const found = await this.findCandidates(automation.org_id, automation.id, notRunSince, automation.trigger_type, automation.trigger_config, now, limit)
        if (!found) continue

        for (const entityId of found.ids) {
          out.entities++
          const context = await this.contextBuilder.execute({
            orgId: automation.org_id,
            entityType: found.entityType,
            entityId,
            now,
          })
          const result = await this.runner.execute({
            orgId: automation.org_id,
            trigger: automation.trigger_type,
            entityType: found.entityType,
            entityId,
            context,
            now,
          })
          out.queued += result.queued
        }
      } catch {
        // Swallowed a propósito: el próximo tick reintenta y las demás
        // automatizaciones del barrido siguen corriendo.
      }
    }

    return out
  }

  private async findCandidates(
    orgId: string,
    automationId: string,
    notRunSince: string | null,
    trigger: string,
    config: Record<string, unknown>,
    now: Date,
    limit: number,
  ): Promise<{ entityType: EntityType; ids: string[] } | null> {
    switch (trigger) {
      case 'lead.sin_contacto_24h': {
        const hours = positiveNumber(config?.horas, 24)
        const ids = await this.candidates.findLeadsWithoutContact(orgId, automationId, notRunSince, hours, now, limit)
        return { entityType: 'lead', ids }
      }
      case 'lead.sin_respuesta_7d': {
        const days = positiveNumber(config?.dias, 7)
        const ids = await this.candidates.findLeadsWithoutActivity(orgId, automationId, notRunSince, days, now, limit)
        return { entityType: 'lead', ids }
      }
      case 'property.publicacion_vencida': {
        const daysAhead = positiveNumber(config?.dias_antes, 7)
        const ids = await this.candidates.findPropertiesWithExpiringAuthorization(orgId, automationId, notRunSince, daysAhead, now, limit)
        return { entityType: 'property', ids }
      }
      default:
        return null
    }
  }
}

function positiveNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Inicio del día UTC — el mismo bucket que usa AutomationRun.dedupeKey. */
function startOfUtcDay(now: Date): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`
}
