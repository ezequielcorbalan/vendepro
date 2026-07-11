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
  topBarrios: Array<{ neighborhood: string; count: number }>
  weeklyTrend: Array<{ week: string; count: number }>
  quarterComparison: {
    previous: number
    current: number
    change: number
    currentByType: Array<{ activity_type: string; count: number }>
    previousByType: Array<{ activity_type: string; count: number }>
  }
}

async function safeRun<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

// Lunes (inicio de semana ISO) en UTC, normalizado a medianoche
function weekStartMonday(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7 // 0 = lunes
  x.setUTCDate(x.getUTCDate() - dow)
  return x
}

function isoWeekKey(monday: Date): string {
  const thu = new Date(monday); thu.setUTCDate(thu.getUTCDate() + 3) // jueves define el año/semana ISO
  const year = thu.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function countByType(list: Array<{ activity_type: string }>): Array<{ activity_type: string; count: number }> {
  const m: Record<string, number> = {}
  for (const a of list) m[a.activity_type] = (m[a.activity_type] ?? 0) + 1
  return Object.entries(m).map(([activity_type, count]) => ({ activity_type, count }))
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
        // Pragmatic: use findByOrg + JS count to avoid scope creep on LeadRepository.
        // Solo pipeline vendedor: las conversiones lead→tasación→captación son de captación.
        safeRun(() => this.leads.findByOrg(orgId, { agent_id: agentId, pipeline: 'vendedor' }), []),
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

    // ── Secciones adicionales (barrios / tendencia / comparación trimestral) ──
    const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const recentRaw = await safeRun(
      () => this.activities.findByOrgSince(orgId, sixMonthsAgo.toISOString(), agentId, 500),
      [],
    )
    const recentActs = (recentRaw ?? []).map(a => a.toObject() as { activity_type: string; created_at: string })

    // Top barrios — a partir de los leads del agente
    const barrioCount: Record<string, number> = {}
    for (const l of allLeads) {
      const n = (l.neighborhood ?? '').trim()
      if (n) barrioCount[n] = (barrioCount[n] ?? 0) + 1
    }
    const topBarrios = Object.entries(barrioCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([neighborhood, count]) => ({ neighborhood, count }))

    // Tendencia semanal — últimas 8 semanas
    const NUM_WEEKS = 8
    const curMonday = weekStartMonday(now)
    const weeks = Array.from({ length: NUM_WEEKS }, (_, i) => {
      const ws = new Date(curMonday); ws.setUTCDate(ws.getUTCDate() - (NUM_WEEKS - 1 - i) * 7)
      return { start: ws.getTime(), week: isoWeekKey(ws), count: 0 }
    })
    for (const a of recentActs) {
      const ws = weekStartMonday(new Date(a.created_at)).getTime()
      const bucket = weeks.find(w => w.start === ws)
      if (bucket) bucket.count++
    }
    const weeklyTrend = weeks.map(w => ({ week: w.week, count: w.count }))

    // Comparación trimestral — trimestre actual vs anterior (rolling 90 días)
    const curQ = recentActs.filter(a => new Date(a.created_at) >= quarterAgo)
    const prevQ = recentActs.filter(a => {
      const t = new Date(a.created_at)
      return t >= sixMonthsAgo && t < quarterAgo
    })
    const change = prevQ.length > 0
      ? Math.round(((curQ.length - prevQ.length) / prevQ.length) * 100)
      : (curQ.length > 0 ? 100 : 0)
    const quarterComparison = {
      previous: prevQ.length,
      current: curQ.length,
      change,
      currentByType: countByType(curQ),
      previousByType: countByType(prevQ),
    }

    const conversions = {
      leadTasacion: total > 0 ? Math.round((totalTas / total) * 100) : 0,
      tasacionCaptacion: totalTas > 0 ? Math.round((captados / totalTas) * 100) : 0,
      leadCaptacion: total > 0 ? Math.round((captados / total) * 100) : 0,
    }

    // Count properties by commercial_stage — support both legacy and current slugs.
    const cs = (p: any) => (p.commercial_stage ?? p.status ?? '') as string
    const propertyStats = {
      captadas: allProperties.filter(p => cs(p) === 'captacion' || cs(p) === 'captada').length,
      publicadas: allProperties.filter(p => cs(p) === 'publicada').length,
      reservadas: allProperties.filter(p => cs(p) === 'reservada').length,
      vendidas: allProperties.filter(p => cs(p) === 'vendida').length,
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
      topBarrios,
      weeklyTrend,
      quarterComparison,
    }
  }
}
