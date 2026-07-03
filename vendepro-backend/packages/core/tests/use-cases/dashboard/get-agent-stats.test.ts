import { describe, it, expect, vi } from 'vitest'
import { GetAgentStatsUseCase } from '../../../src/application/use-cases/dashboard/get-agent-stats'

function makeUserRepo() {
  return { findProfileById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(), findById: vi.fn(), findByEmail: vi.fn(), existsByEmail: vi.fn(), findAll: vi.fn() }
}

function makeLeadRepo() {
  return { findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(), searchByName: vi.fn(), findPendingFollowups: vi.fn(), exportAllWithAssignedName: vi.fn() }
}

function makeAppraisalRepo() {
  return { findById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(), countByOrg: vi.fn(), countByOrgAndStage: vi.fn(), countByAgent: vi.fn() }
}

function makeActivityRepo() {
  return { findByOrg: vi.fn(), findById: vi.fn(), save: vi.fn(), delete: vi.fn(), findByOrgSince: vi.fn(), findLatestByOrg: vi.fn(), aggregateByTypeSince: vi.fn() }
}

function makeObjectiveRepo() {
  return { findByAgent: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() }
}

function makePropertyRepo() {
  return {
    findById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
    findPhotos: vi.fn(), addPhoto: vi.fn(), deletePhoto: vi.fn(), reorderPhotos: vi.fn(),
    update: vi.fn(), updateStage: vi.fn(), findCatalogs: vi.fn(),
    markExternalReport: vi.fn(), clearExternalReport: vi.fn(), searchByAddress: vi.fn(),
  }
}

describe('GetAgentStatsUseCase', () => {
  it('returns stats with correct shape', async () => {
    const users = makeUserRepo()
    const leads = makeLeadRepo()
    const appraisals = makeAppraisalRepo()
    const activities = makeActivityRepo()
    const objectives = makeObjectiveRepo()
    const properties = makePropertyRepo()

    users.findProfileById.mockResolvedValue({ full_name: 'Ana Agente', id: 'u1', org_id: 'org1', email: 'a@b.com', role: 'agent', created_at: '' })
    leads.findByOrg.mockResolvedValue([
      { stage: 'captado', neighborhood: 'Palermo' },
      { stage: 'nuevo', neighborhood: 'Palermo' },
      { stage: 'nuevo', neighborhood: 'Belgrano' },
      { stage: 'nuevo', neighborhood: null },
    ])
    appraisals.countByAgent.mockResolvedValue(3)
    activities.aggregateByTypeSince.mockResolvedValue([{ activity_type: 'llamada', count: 5 }])
    activities.findByOrgSince.mockResolvedValue([
      { toObject: () => ({ activity_type: 'llamada', created_at: '2026-06-20T10:00:00Z' }) },
      { toObject: () => ({ activity_type: 'reunion', created_at: '2026-06-21T10:00:00Z' }) },
    ])
    objectives.findByAgent.mockResolvedValue([])
    properties.findByOrg.mockResolvedValue([])

    const uc = new GetAgentStatsUseCase(users, leads, appraisals, activities, objectives, properties)
    const result = await uc.execute('org1', 'u1')

    expect(result.agent.full_name).toBe('Ana Agente')
    expect(result.leadStats.total).toBe(4)
    expect(result.tasacionStats.total).toBe(3)
    expect(result.activityMonth).toEqual([{ activity_type: 'llamada', count: 5 }])
    expect(result.objectives).toEqual([])
    expect(result.propertyStats).toHaveProperty('captadas')
    // Nuevas secciones
    expect(result.topBarrios).toEqual([
      { neighborhood: 'Palermo', count: 2 },
      { neighborhood: 'Belgrano', count: 1 },
    ])
    expect(result.weeklyTrend).toHaveLength(8)
    expect(result.weeklyTrend.every(w => typeof w.week === 'string' && typeof w.count === 'number')).toBe(true)
    expect(result.quarterComparison).toHaveProperty('current')
    expect(result.quarterComparison).toHaveProperty('previous')
    expect(result.quarterComparison).toHaveProperty('change')
    expect(Array.isArray(result.quarterComparison.currentByType)).toBe(true)
  })

  it('falls back gracefully when repos throw', async () => {
    const users = makeUserRepo()
    const leads = makeLeadRepo()
    const appraisals = makeAppraisalRepo()
    const activities = makeActivityRepo()
    const objectives = makeObjectiveRepo()
    const properties = makePropertyRepo()

    users.findProfileById.mockRejectedValue(new Error('DB error'))
    leads.findByOrg.mockRejectedValue(new Error('DB error'))
    appraisals.countByAgent.mockRejectedValue(new Error('DB error'))
    activities.aggregateByTypeSince.mockRejectedValue(new Error('DB error'))
    activities.findByOrgSince.mockRejectedValue(new Error('DB error'))
    objectives.findByAgent.mockRejectedValue(new Error('DB error'))
    properties.findByOrg.mockRejectedValue(new Error('DB error'))

    const uc = new GetAgentStatsUseCase(users, leads, appraisals, activities, objectives, properties)
    const result = await uc.execute('org1', 'u1')

    expect(result.agent.full_name).toBe('Agente')
    expect(result.leadStats.total).toBe(0)
    expect(result.tasacionStats.total).toBe(0)
    expect(result.objectives).toEqual([])
    // Nuevas secciones degradan sin romper
    expect(result.topBarrios).toEqual([])
    expect(result.weeklyTrend).toHaveLength(8)
    expect(result.quarterComparison.current).toBe(0)
  })
})
