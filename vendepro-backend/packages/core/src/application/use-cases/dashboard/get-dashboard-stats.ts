import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { ReservationRepository } from '../../ports/repositories/reservation-repository'
import type { CalendarRepository } from '../../ports/repositories/calendar-repository'

export interface DashboardStats {
  totalLeads: number
  activeLeads: number
  urgentLeads: number
  totalProperties: number
  activeProperties: number
  totalReservations: number
  activeReservations: number
  overdueEvents: number
  /** Desglose por etapa de TODA la historia (KPIs + pipeline) */
  stageBreakdown: Record<string, number>
  /** Desglose por etapa acotado al período `since` — solo alimenta el funnel */
  funnelStageBreakdown: Record<string, number>
  /** Total de leads del período `since` — denominador del funnel */
  funnelTotalLeads: number
}

export class GetDashboardStatsUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly propertyRepo: PropertyRepository,
    private readonly reservationRepo: ReservationRepository,
    private readonly calendarRepo: CalendarRepository,
  ) {}

  /**
   * Los KPIs y el pipeline (`stageBreakdown`, totales) son SIEMPRE de toda la
   * historia. `since` acota únicamente el funnel (`funnelStageBreakdown` /
   * `funnelTotalLeads`), que es el widget que se filtra por período.
   */
  async execute(orgId: string, agentId?: string, since?: string): Promise<DashboardStats> {
    const [allLeads, properties, reservations, events] = await Promise.all([
      // KPIs y funnel son del pipeline vendedor (los compradores tienen métricas propias).
      this.leadRepo.findByOrg(orgId, { pipeline: 'vendedor', ...(agentId ? { agent_id: agentId } : {}) }),
      this.propertyRepo.findByOrg(orgId, agentId ? { agent_id: agentId } : undefined),
      this.reservationRepo.findByOrg(orgId, agentId ? { agent_id: agentId } : undefined),
      this.calendarRepo.findByOrg(orgId, agentId ? { agent_id: agentId } : undefined),
    ])

    const activeLeads = allLeads.filter(l => l.stage !== 'captado' && l.stage !== 'perdido')
    const urgentLeads = activeLeads.filter(l => l.getUrgency() === 'danger')

    const stageBreakdown: Record<string, number> = {}
    for (const lead of allLeads) {
      stageBreakdown[lead.stage] = (stageBreakdown[lead.stage] ?? 0) + 1
    }

    // Funnel: acotado al período si hay `since`
    const funnelLeads = since ? allLeads.filter(l => (l.created_at ?? '') >= since) : allLeads
    const funnelStageBreakdown: Record<string, number> = {}
    for (const lead of funnelLeads) {
      funnelStageBreakdown[lead.stage] = (funnelStageBreakdown[lead.stage] ?? 0) + 1
    }

    const now = new Date()
    const overdueEvents = events.filter(e => e.isOverdue(now)).length

    return {
      totalLeads: allLeads.length,
      activeLeads: activeLeads.length,
      urgentLeads: urgentLeads.length,
      totalProperties: properties.length,
      activeProperties: properties.filter(p => p.status === 'active').length,
      totalReservations: reservations.length,
      activeReservations: reservations.filter(r => r.stage !== 'entregada' && r.stage !== 'cancelada' && r.stage !== 'rechazada').length,
      overdueEvents,
      stageBreakdown,
      funnelStageBreakdown,
      funnelTotalLeads: funnelLeads.length,
    }
  }
}
