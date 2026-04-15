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
  stageBreakdown: Record<string, number>
}

export class GetDashboardStatsUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly propertyRepo: PropertyRepository,
    private readonly reservationRepo: ReservationRepository,
    private readonly calendarRepo: CalendarRepository,
  ) {}

  async execute(orgId: string, agentId?: string): Promise<DashboardStats> {
    const [leads, properties, reservations, events] = await Promise.all([
      this.leadRepo.findByOrg(orgId, agentId ? { agent_id: agentId } : undefined),
      this.propertyRepo.findByOrg(orgId, agentId ? { agent_id: agentId } : undefined),
      this.reservationRepo.findByOrg(orgId, agentId ? { agent_id: agentId } : undefined),
      this.calendarRepo.findByOrg(orgId, agentId ? { agent_id: agentId } : undefined),
    ])

    const activeLeads = leads.filter(l => l.stage !== 'captado' && l.stage !== 'perdido')
    const urgentLeads = activeLeads.filter(l => l.getUrgency() === 'danger')

    const stageBreakdown: Record<string, number> = {}
    for (const lead of leads) {
      stageBreakdown[lead.stage] = (stageBreakdown[lead.stage] ?? 0) + 1
    }

    const now = new Date()
    const overdueEvents = events.filter(e => e.isOverdue(now)).length

    return {
      totalLeads: leads.length,
      activeLeads: activeLeads.length,
      urgentLeads: urgentLeads.length,
      totalProperties: properties.length,
      activeProperties: properties.filter(p => p.status === 'active').length,
      totalReservations: reservations.length,
      activeReservations: reservations.filter(r => r.stage !== 'entregada' && r.stage !== 'cancelada' && r.stage !== 'rechazada').length,
      overdueEvents,
      stageBreakdown,
    }
  }
}
