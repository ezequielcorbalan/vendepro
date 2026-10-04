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
 * Qué tan rápido atiende un agente. Se mide sobre `leads.first_contact_at`,
 * que el dominio escribe en la transición nuevo → contactado.
 */
export interface AgentFirstResponse {
  agent_id: string | null
  /** Leads con primer contacto registrado: la base de la medición. */
  medidos: number
  /** De ésos, cuántos se contactaron dentro de las 24h (la regla del negocio). */
  en_24h: number
  /**
   * Siguen en `nuevo` y ya pasaron 24h: nunca se contactaron. Cuentan como
   * incumplidos, si no el que no llama a nadie tendría 100%.
   */
  nunca_contactados: number
  /**
   * Avanzaron de etapa sin pasar por nuevo → contactado (importados, o
   * cargados ya contactados): no hay con qué medirlos, así que quedan fuera
   * del porcentaje en vez de contarse como incumplidos.
   */
  sin_dato: number
  /**
   * Mediana de horas hasta el primer contacto. Mediana y no promedio: un lead
   * contestado a los 20 días no puede definir el número de todo el mes.
   */
  mediana_horas: number | null
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
  aggregateFirstResponseByAgent(orgId: string, pipeline: LeadPipeline): Promise<AgentFirstResponse[]>
}
