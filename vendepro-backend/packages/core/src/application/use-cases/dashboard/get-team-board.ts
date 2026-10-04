import type { UserRepository } from '../../ports/repositories/user-repository'
import type { ActivityRepository } from '../../ports/repositories/activity-repository'
import type { TeamStatsRepository, AgentLeadAggregate, AgentFirstResponse } from '../../ports/repositories/team-stats-repository'
import type { LeadPipeline } from '../../../domain/value-objects/lead-stage'
import { WON_STAGE, isTerminalStage } from '../../../domain/value-objects/lead-stage'

export interface TeamBoardAgentRow {
  id: string
  full_name: string
  role: string
  /** Todos los leads que pasaron por sus manos en este pipeline. */
  total_leads: number
  /** Los que siguen vivos (ni ganados ni terminales). */
  activos: number
  /** Ganados: `captado` en vendedor, `cerrado` en comprador. */
  captados: number
  /** captados ÷ total_leads, en % entero. */
  conversion: number
  /** Leads `nuevo` que ya pasaron las 24h sin contactar. */
  sin_contactar_24h: number
  /** Leads vivos sin ningún movimiento hace más de 7 días. */
  sin_movimiento_7d: number
  /** Cuántos tiene en cada etapa (sólo las que tienen alguno). */
  por_etapa: Record<string, number>
  /** Actividades registradas en los últimos 30 días. */
  actividad_mes: number
  /** Última vez que movió alguno de sus leads. */
  ultimo_movimiento: string | null
  /** % de leads contactados dentro de las 24h. `null` si no hay con qué medir. */
  en_24h_pct: number | null
  /** Cuánto tarda típicamente en hacer el primer contacto. */
  mediana_respuesta_h: number | null
  /** Leads que no se pueden medir (avanzaron sin registrar el primer contacto). */
  respuesta_sin_dato: number
}

export interface TeamBoardResult {
  pipeline: LeadPipeline
  agents: TeamBoardAgentRow[]
  /** Leads sin dueño: la cola que hay que repartir. */
  sin_asignar: { total: number; sin_contactar_24h: number }
  /** Fila de totales de la inmobiliaria, para comparar a cada agente contra el conjunto. */
  totales: { total_leads: number; activos: number; captados: number; conversion: number; sin_contactar_24h: number; sin_movimiento_7d: number }
}

/**
 * Tablero del equipo: una fila por agente con su carga, su conversión y lo que
 * tiene atrasado.
 *
 * Existe aparte de `GetTeamStatsUseCase` (la tarjeta chica del dashboard, 4
 * números por agente) porque acá lo que importa es la situación operativa: qué
 * está parado, quién tiene cola sin contactar y cuántos leads viven en cada
 * etapa de cada agente.
 *
 * Los conteos salen agregados de la base, no de traer los leads a memoria: el
 * camino viejo pasaba por `findByOrg`, que corta en 500 por pipeline.
 */
export class GetTeamBoardUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly teamStats: TeamStatsRepository,
    private readonly activities: ActivityRepository,
  ) {}

  async execute(orgId: string, pipeline: LeadPipeline = 'vendedor'): Promise<TeamBoardResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [team, aggregates, respuestas, activityByAgent] = await Promise.all([
      this.users.findByOrg(orgId),
      this.teamStats.aggregateLeadsByAgent(orgId, pipeline),
      this.teamStats.aggregateFirstResponseByAgent(orgId, pipeline),
      this.activities.countByAgentSince(orgId, thirtyDaysAgo),
    ])

    const respuestaPorAgente = new Map<string, AgentFirstResponse>()
    for (const r of respuestas) {
      if (r.agent_id !== null) respuestaPorAgente.set(r.agent_id, r)
    }

    const byAgent = new Map<string, AgentLeadAggregate>()
    let unassigned: AgentLeadAggregate | null = null
    for (const agg of aggregates) {
      if (agg.agent_id === null) unassigned = agg
      else byAgent.set(agg.agent_id, agg)
    }

    const won = WON_STAGE[pipeline]
    const agents = team
      .map(user => {
        const o = user.toObject()
        const agg = byAgent.get(o.id)
        const resp = respuestaPorAgente.get(o.id)
        const total = agg?.total ?? 0
        const captados = agg?.by_stage[won] ?? 0
        return {
          id: o.id,
          full_name: o.full_name,
          role: o.role,
          total_leads: total,
          activos: countActive(agg, pipeline, won),
          captados,
          conversion: total > 0 ? Math.round((captados / total) * 100) : 0,
          sin_contactar_24h: agg?.sin_contactar_24h ?? 0,
          sin_movimiento_7d: agg?.sin_movimiento_7d ?? 0,
          por_etapa: agg?.by_stage ?? {},
          actividad_mes: activityByAgent[o.id] ?? 0,
          ultimo_movimiento: agg?.ultimo_movimiento ?? null,
          en_24h_pct: pctEn24h(resp),
          mediana_respuesta_h: resp?.mediana_horas ?? null,
          respuesta_sin_dato: resp?.sin_dato ?? 0,
        }
      })
      // Sin leads ni actividad no hay nada que mirar: son usuarios
      // administrativos, no comerciales, y sólo hacen scroll.
      .filter(a => a.total_leads > 0 || a.actividad_mes > 0)
      // Primero quien tiene trabajo atrasado: el tablero es para actuar, no
      // para premiar. El ranking por captados queda a un click de ordenar.
      .sort((a, b) =>
        (b.sin_contactar_24h - a.sin_contactar_24h) ||
        (b.sin_movimiento_7d - a.sin_movimiento_7d) ||
        (b.captados - a.captados) ||
        (b.total_leads - a.total_leads))

    const totales = agents.reduce(
      (acc, a) => ({
        total_leads: acc.total_leads + a.total_leads,
        activos: acc.activos + a.activos,
        captados: acc.captados + a.captados,
        conversion: 0,
        sin_contactar_24h: acc.sin_contactar_24h + a.sin_contactar_24h,
        sin_movimiento_7d: acc.sin_movimiento_7d + a.sin_movimiento_7d,
      }),
      { total_leads: 0, activos: 0, captados: 0, conversion: 0, sin_contactar_24h: 0, sin_movimiento_7d: 0 },
    )
    totales.conversion = totales.total_leads > 0 ? Math.round((totales.captados / totales.total_leads) * 100) : 0

    return {
      pipeline,
      agents,
      sin_asignar: {
        total: unassigned?.total ?? 0,
        sin_contactar_24h: unassigned?.sin_contactar_24h ?? 0,
      },
      totales,
    }
  }
}

/**
 * % de leads atendidos dentro de las 24h.
 *
 * El denominador incluye los que nunca se contactaron y ya vencieron: medir
 * sólo sobre los contactados le daría 100% al que no llama a nadie. Los que
 * avanzaron sin registrar primer contacto quedan afuera —no hay con qué
 * medirlos— y se informan aparte en `respuesta_sin_dato`.
 */
function pctEn24h(resp: AgentFirstResponse | undefined): number | null {
  if (!resp) return null
  const base = resp.medidos + resp.nunca_contactados
  if (base === 0) return null
  return Math.round((resp.en_24h / base) * 100)
}

/** Vivos: ni la etapa ganada ni las terminales. */
function countActive(agg: AgentLeadAggregate | undefined, pipeline: LeadPipeline, won: string): number {
  if (!agg) return 0
  return Object.entries(agg.by_stage)
    .filter(([stage]) => stage !== won && !isTerminalStage(stage, pipeline))
    .reduce((sum, [, count]) => sum + count, 0)
}
