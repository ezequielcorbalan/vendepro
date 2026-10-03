import type { LeadPipeline } from '../../../domain/value-objects/lead-stage'

/** Leads de un agente, ya contados por la base. `agent_id` null = sin asignar. */
export interface AgentLeadAggregate {
  agent_id: string | null
  /** Cuántos leads tiene en cada etapa. */
  by_stage: Record<string, number>
  total: number
  /** Etapa `nuevo` creada hace más de 24h — la regla de contacto del negocio. */
  sin_contactar_24h: number
  /** Sin ningún movimiento hace más de 7 días (sólo leads vivos). */
  sin_movimiento_7d: number
  /** `updated_at` más reciente entre sus leads vivos. */
  ultimo_movimiento: string | null
}

/**
 * Lecturas agregadas para el tablero del equipo.
 *
 * Port aparte de `LeadRepository` a propósito: esto no devuelve entidades sino
 * números que calcula la base. El tablero anterior traía todos los leads a
 * memoria para contarlos, y `findByOrg` corta en 500 por pipeline: los
 * porcentajes salían incompletos sin que nada lo avisara.
 */
export interface TeamStatsRepository {
  aggregateLeadsByAgent(orgId: string, pipeline: LeadPipeline): Promise<AgentLeadAggregate[]>
}
