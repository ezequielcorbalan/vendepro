import type { UserRepository } from '../../ports/repositories/user-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ActivityRepository } from '../../ports/repositories/activity-repository'
import type { LeadPipeline } from '../../../domain/value-objects/lead-stage'

export interface TeamAgentStats {
  id: string
  full_name: string
  role: string
  total_leads: number
  /**
   * Leads que el agente llevó hasta la meta de su pipeline: `captado` en
   * vendedores, `cerrado` en compradores. El nombre es neutro a propósito —
   * decirle `captados` en la pestaña de compradores sería mentir sobre qué
   * cuenta el número.
   */
  ganados: number
  /** ganados ÷ total_leads, en % entero. */
  conversion: number
  /** Actividades registradas en los últimos 30 días. */
  actividad_mes: number
}

/** Etapa que cuenta como "ganado" en cada pipeline. */
const WON_STAGE: Record<LeadPipeline, string> = {
  vendedor: 'captado',
  comprador: 'cerrado',
}

/**
 * KPIs de cada agente para la tarjeta "Equipo" del dashboard.
 *
 * Reemplaza el `agentPerformance: []` que la API devolvía fijo: el frontend ya
 * tenía el ranking programado (nombre, leads, ganados, conversión, barra) pero
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

  /**
   * @param pipeline Qué ranking se pide. Los dos pipelines tienen metas
   * distintas —captar una propiedad vs. cerrar una compra— y un agente puede
   * andar bien en uno y mal en el otro, así que mezclarlos da un promedio que
   * no describe a nadie.
   */
  async execute(orgId: string, pipeline: LeadPipeline = 'vendedor'): Promise<TeamAgentStats[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [team, orgLeads, activityByAgent] = await Promise.all([
      this.users.findByOrg(orgId),
      this.leads.findByOrg(orgId, { pipeline }),
      this.activities.countByAgentSince(orgId, thirtyDaysAgo),
    ])

    const wonStage = WON_STAGE[pipeline]
    const totals: Record<string, number> = {}
    const ganados: Record<string, number> = {}
    for (const lead of orgLeads) {
      const agentId = lead.assigned_to
      if (!agentId) continue
      totals[agentId] = (totals[agentId] ?? 0) + 1
      if (lead.stage === wonStage) ganados[agentId] = (ganados[agentId] ?? 0) + 1
    }

    return team
      .map(user => {
        const o = user.toObject()
        const total = totals[o.id] ?? 0
        const won = ganados[o.id] ?? 0
        return {
          id: o.id,
          full_name: o.full_name,
          role: o.role,
          total_leads: total,
          ganados: won,
          conversion: total > 0 ? Math.round((won / total) * 100) : 0,
          actividad_mes: activityByAgent[o.id] ?? 0,
        }
      })
      // Los que no tienen ni leads ni actividad no aportan al ranking y sólo
      // hacen scroll (típicamente usuarios administrativos, no comerciales).
      // La actividad NO está acotada al pipeline (una llamada no sabe de cuál
      // es), así que alguien que sólo trabaja compradores igual aparece en el
      // ranking de vendedores — con 0 leads, que es la verdad.
      .filter(a => a.total_leads > 0 || a.actividad_mes > 0)
      .sort((a, b) => b.ganados - a.ganados || b.total_leads - a.total_leads)
  }
}
