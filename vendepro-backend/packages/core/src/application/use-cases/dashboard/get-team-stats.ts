import type { UserRepository } from '../../ports/repositories/user-repository'
import type { ActivityRepository } from '../../ports/repositories/activity-repository'
import type { TeamStatsRepository } from '../../ports/repositories/team-stats-repository'
import { WON_STAGE } from '../../../domain/value-objects/lead-stage'

export interface TeamAgentStats {
  id: string
  full_name: string
  role: string
  total_leads: number
  captados: number
  /** captados ÷ total_leads, en % entero. */
  conversion: number
  /** Actividades registradas en los últimos 30 días. */
  actividad_mes: number
}

/**
 * KPIs de cada agente para la tarjeta "Equipo" del dashboard.
 *
 * Reemplaza el `agentPerformance: []` que la API devolvía fijo: el frontend ya
 * tenía el ranking programado (nombre, leads, captados, conversión, barra) pero
 * nunca podía mostrarlo porque nunca llegaban datos.
 *
 * Los conteos salen agregados de la base. Antes traía todos los leads con
 * `findByOrg` para contarlos acá, y ese método corta en 500 por pipeline: a
 * partir de ahí los totales y las conversiones salían cortos sin que nada lo
 * avisara. Es el mismo port que usa el tablero `/equipo`, así que las dos
 * pantallas no pueden mostrar números distintos del mismo equipo.
 *
 * Sólo lo pide la inmobiliaria (admin/owner/supervisor). Un agente ve sus
 * propios números en su dashboard, ya acotados por `agent_id`.
 */
export class GetTeamStatsUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly teamStats: TeamStatsRepository,
    private readonly activities: ActivityRepository,
  ) {}

  async execute(orgId: string): Promise<TeamAgentStats[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [team, aggregates, activityByAgent] = await Promise.all([
      this.users.findByOrg(orgId),
      // Pipeline vendedor: "captado" es la meta de captación. La conversión de
      // compradores se mide sobre "cerrado" y va en su propio dashboard.
      this.teamStats.aggregateLeadsByAgent(orgId, 'vendedor'),
      this.activities.countByAgentSince(orgId, thirtyDaysAgo),
    ])

    // Los leads sin agente (agent_id null) no son de nadie: no suman al ranking.
    const byAgent = new Map(
      aggregates.filter(a => a.agent_id !== null).map(a => [a.agent_id as string, a]),
    )
    const won = WON_STAGE.vendedor

    return team
      .map(user => {
        const o = user.toObject()
        const agg = byAgent.get(o.id)
        const total = agg?.total ?? 0
        const captados = agg?.by_stage[won] ?? 0
        return {
          id: o.id,
          full_name: o.full_name,
          role: o.role,
          total_leads: total,
          captados,
          conversion: total > 0 ? Math.round((captados / total) * 100) : 0,
          actividad_mes: activityByAgent[o.id] ?? 0,
        }
      })
      // Los que no tienen ni leads ni actividad no aportan al ranking y sólo
      // hacen scroll (típicamente usuarios administrativos, no comerciales).
      .filter(a => a.total_leads > 0 || a.actividad_mes > 0)
      .sort((a, b) => b.captados - a.captados || b.total_leads - a.total_leads)
  }
}
