import type { UserRepository } from '../../ports/repositories/user-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { ActivityRepository } from '../../ports/repositories/activity-repository'
import type { ObjectiveRepository } from '../../ports/repositories/objective-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'

export interface AgentStats {
  agent: { full_name: string }
  leadStats: { total: number; captados: number }
  tasacionStats: { total: number }
  activityMonth: Array<{ activity_type: string; count: number }>
  activityQuarter: Array<{ activity_type: string; count: number }>
  activityYear: Array<{ activity_type: string; count: number }>
  conversions: { leadTasacion: number; tasacionCaptacion: number; leadCaptacion: number }
  objectives: Array<Record<string, unknown>>
  propertyStats: { captadas: number; publicadas: number; reservadas: number; vendidas: number }
}

async function safeRun<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

export class GetAgentStatsUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly leads: LeadRepository,
    private readonly appraisals: AppraisalRepository,
    private readonly activities: ActivityRepository,
    private readonly objectives: ObjectiveRepository,
    private readonly properties: PropertyRepository,
  ) {}

  async execute(orgId: string, agentId: string): Promise<AgentStats> {
    const now = new Date()
    const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1)
    const quarterAgo = new Date(now); quarterAgo.setMonth(quarterAgo.getMonth() - 3)
    const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1)

    const [agentUser, allLeads, totalTas, actMonth, actQuarter, actYear, agentObjectives, allProperties] =
      await Promise.all([
        safeRun(() => this.users.findProfileById(agentId), null),
        // Pragmatic: use findByOrg + JS count to avoid scope creep on LeadRepository
        safeRun(() => this.leads.findByOrg(orgId, { agent_id: agentId }), []),
        safeRun(() => this.appraisals.countByAgent(orgId, agentId), 0),
        safeRun(() => this.activities.aggregateByTypeSince(orgId, agentId, monthAgo.toISOString()), []),
        safeRun(() => this.activities.aggregateByTypeSince(orgId, agentId, quarterAgo.toISOString()), []),
        safeRun(() => this.activities.aggregateByTypeSince(orgId, agentId, yearAgo.toISOString()), []),
        // Note: agent_objectives has no is_active column in the schema — findByAgent uses period_end >= now()
        safeRun(() => this.objectives.findByAgent(agentId, orgId), []),
        // Pragmatic: use findByOrg + JS count for property stats to avoid scope creep
        safeRun(() => this.properties.findByOrg(orgId, { agent_id: agentId }), []),
      ])

    const total = allLeads.length
    const captados = allLeads.filter(l => l.stage === 'captado').length

    const conversions = {
      leadTasacion: total > 0 ? Math.round((totalTas / total) * 100) : 0,
      tasacionCaptacion: totalTas > 0 ? Math.round((captados / totalTas) * 100) : 0,
      leadCaptacion: total > 0 ? Math.round((captados / total) * 100) : 0,
    }

    // Pragmatic: count property statuses in JS (avoids adding countByAgentAndStatus port method).
    // Cast to string since legacy DB may store 'captada'/'publicada' etc (different from PropertyStatus type).
    const propertyStats = {
      captadas: allProperties.filter(p => (p.status as string) === 'captada').length,
      publicadas: allProperties.filter(p => (p.status as string) === 'publicada').length,
      reservadas: allProperties.filter(p => (p.status as string) === 'reservada').length,
      vendidas: allProperties.filter(p => (p.status as string) === 'vendida').length,
    }

    return {
      agent: { full_name: agentUser?.full_name ?? 'Agente' },
      leadStats: { total, captados },
      tasacionStats: { total: totalTas },
      activityMonth: actMonth,
      activityQuarter: actQuarter,
      activityYear: actYear,
      conversions,
      objectives: agentObjectives.map(o => o.toObject() as unknown as Record<string, unknown>),
      propertyStats,
    }
  }
}
