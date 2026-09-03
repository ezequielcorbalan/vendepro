import type { UserRepository } from '../../ports/repositories/user-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ActivityRepository } from '../../ports/repositories/activity-repository'

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
 * Sólo lo pide la inmobiliaria (admin/owner/supervisor). Un agente ve sus
 * propios números en su dashboard, ya acotados por `agent_id`.
 */
export class GetTeamStatsUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly leads: LeadRepository,
    private readonly activities: ActivityRepository,
  ) {}

  async execute(orgId: string): Promise<TeamAgentStats[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [team, orgLeads, activityByAgent] = await Promise.all([
      this.users.findByOrg(orgId),
      // Pipeline vendedor: "captado" es la meta de captación. La conversión de
      // compradores se mide sobre "cerrado" y va en su propio dashboard.
      this.leads.findByOrg(orgId, { pipeline: 'vendedor' }),
      this.activities.countByAgentSince(orgId, thirtyDaysAgo),
    ])

    const totals: Record<string, number> = {}
    const captados: Record<string, number> = {}
    for (const lead of orgLeads) {
      const agentId = lead.assigned_to
      if (!agentId) continue
      totals[agentId] = (totals[agentId] ?? 0) + 1
      if (lead.stage === 'captado') captados[agentId] = (captados[agentId] ?? 0) + 1
    }

    return team
      .map(user => {
        const o = user.toObject()
        const total = totals[o.id] ?? 0
        const won = captados[o.id] ?? 0
        return {
          id: o.id,
          full_name: o.full_name,
          role: o.role,
          total_leads: total,
          captados: won,
          conversion: total > 0 ? Math.round((won / total) * 100) : 0,
          actividad_mes: activityByAgent[o.id] ?? 0,
        }
      })
      // Los que no tienen ni leads ni actividad no aportan al ranking y sólo
      // hacen scroll (típicamente usuarios administrativos, no comerciales).
      .filter(a => a.total_leads > 0 || a.actividad_mes > 0)
      .sort((a, b) => b.captados - a.captados || b.total_leads - a.total_leads)
  }
}
