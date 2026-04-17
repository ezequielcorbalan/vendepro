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
    leads.findByOrg.mockResolvedValue([])
    appraisals.countByAgent.mockResolvedValue(3)
    activities.aggregateByTypeSince.mockResolvedValue([{ activity_type: 'llamada', count: 5 }])
    objectives.findByAgent.mockResolvedValue([])
    properties.findByOrg.mockResolvedValue([])

    const uc = new GetAgentStatsUseCase(users, leads, appraisals, activities, objectives, properties)
    const result = await uc.execute('org1', 'u1')

    expect(result.agent.full_name).toBe('Ana Agente')
    expect(result.leadStats.total).toBe(0)
    expect(result.tasacionStats.total).toBe(3)
    expect(result.activityMonth).toEqual([{ activity_type: 'llamada', count: 5 }])
    expect(result.objectives).toEqual([])
    expect(result.propertyStats).toHaveProperty('captadas')
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
    objectives.findByAgent.mockRejectedValue(new Error('DB error'))
    properties.findByOrg.mockRejectedValue(new Error('DB error'))

    const uc = new GetAgentStatsUseCase(users, leads, appraisals, activities, objectives, properties)
    const result = await uc.execute('org1', 'u1')

    expect(result.agent.full_name).toBe('Agente')
    expect(result.leadStats.total).toBe(0)
    expect(result.tasacionStats.total).toBe(0)
    expect(result.objectives).toEqual([])
  })
})
