import type { ActivityRepository } from '../../ports/repositories/activity-repository'

export interface ActivityStats {
  summary: { total: number; llamadas: number; reuniones: number; visitas: number }
  weekly: Array<{ day: string; count: number }>
  recent: Array<{ id: string; activity_type: string; description: string | null; created_at: string; agent_name: string | null }>
}

export class GetActivityStatsUseCase {
  constructor(private readonly repo: ActivityRepository) {}

  async execute(orgId: string, agentId?: string): Promise<ActivityStats> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const acts = await this.repo.findByOrgSince(orgId, thirtyDaysAgo, agentId, 500)

      // summary
      const summary = {
        total: acts.length,
        llamadas: acts.filter(a => a.activity_type === 'llamada').length,
        reuniones: acts.filter(a => a.activity_type === 'reunion').length,
        visitas: acts.filter(a => ['visita_captacion', 'visita_comprador'].includes(a.activity_type)).length,
      }

      // weekly (last 7 days)
      const dayMap: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0] ?? ''
        dayMap[key] = 0
      }
      for (const a of acts) {
        const day = a.created_at.split('T')[0] ?? ''
        if (day && day in dayMap) dayMap[day] = (dayMap[day] ?? 0) + 1
      }
      const weekly = Object.entries(dayMap).map(([day, count]) => ({ day, count }))

      // recent (last 5 with agent_name join)
      const recent = await this.repo.findLatestByOrg(orgId, 5)
      return {
        summary,
        weekly,
        recent: recent.map(r => ({
          id: r.id,
          activity_type: r.activity_type,
          description: r.description ?? null,
          created_at: r.created_at,
          agent_name: (r as any).agent_name ?? null,
        })),
      }
    } catch {
      return {
        summary: { total: 0, llamadas: 0, reuniones: 0, visitas: 0 },
        weekly: [],
        recent: [],
      }
    }
  }
}
