import { describe, it, expect, vi } from 'vitest'
import { GetActivityStatsUseCase } from '../../../src/application/use-cases/dashboard/get-activity-stats'
import { Activity } from '../../../src/domain/entities/activity'

function makeRepo() {
  return {
    findByOrg: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findByOrgSince: vi.fn(),
    findLatestByOrg: vi.fn(),
    aggregateByTypeSince: vi.fn(),
  }
}

function makeActivity(activity_type: string, daysAgo = 0): Activity {
  const dt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return Activity.create({
    id: `act-${Math.random()}`, org_id: 'org1', agent_id: 'agent1',
    activity_type: activity_type as any, description: null,
    result: null, duration_minutes: null,
    lead_id: null, contact_id: null, property_id: null, appraisal_id: null,
    created_at: dt,
  })
}

describe('GetActivityStatsUseCase', () => {
  it('computes summary counts correctly', async () => {
    const repo = makeRepo()
    repo.findByOrgSince.mockResolvedValue([
      makeActivity('llamada'),
      makeActivity('llamada'),
      makeActivity('reunion'),
      makeActivity('visita_captacion'),
      makeActivity('admin'),
    ])
    repo.findLatestByOrg.mockResolvedValue([])

    const result = await new GetActivityStatsUseCase(repo).execute('org1')
    expect(result.summary.total).toBe(5)
    expect(result.summary.llamadas).toBe(2)
    expect(result.summary.reuniones).toBe(1)
    expect(result.summary.visitas).toBe(1)
  })

  it('builds weekly map with 7 entries', async () => {
    const repo = makeRepo()
    repo.findByOrgSince.mockResolvedValue([makeActivity('llamada', 0)])
    repo.findLatestByOrg.mockResolvedValue([])

    const result = await new GetActivityStatsUseCase(repo).execute('org1')
    expect(result.weekly).toHaveLength(7)
    // today's count should be 1
    const today = new Date().toISOString().split('T')[0]
    const todayEntry = result.weekly.find(e => e.day === today)
    expect(todayEntry?.count).toBe(1)
  })

  it('returns empty fallback on repo error', async () => {
    const repo = makeRepo()
    repo.findByOrgSince.mockRejectedValue(new Error('table missing'))
    repo.findLatestByOrg.mockRejectedValue(new Error('table missing'))

    const result = await new GetActivityStatsUseCase(repo).execute('org1')
    expect(result.summary).toEqual({ total: 0, llamadas: 0, reuniones: 0, visitas: 0 })
    expect(result.weekly).toEqual([])
    expect(result.recent).toEqual([])
  })

  it('passes agentId filter to repo', async () => {
    const repo = makeRepo()
    repo.findByOrgSince.mockResolvedValue([])
    repo.findLatestByOrg.mockResolvedValue([])

    await new GetActivityStatsUseCase(repo).execute('org1', 'agent42')
    expect(repo.findByOrgSince).toHaveBeenCalledWith('org1', expect.any(String), 'agent42', 500)
  })
})
