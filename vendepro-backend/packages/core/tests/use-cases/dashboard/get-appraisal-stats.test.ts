import { describe, it, expect, vi } from 'vitest'
import { GetAppraisalStatsUseCase } from '../../../src/application/use-cases/dashboard/get-appraisal-stats'

function makeRepo() {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findByOrg: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    countByOrg: vi.fn(),
    countByOrgAndStage: vi.fn(),
    countByAgent: vi.fn(),
  }
}

describe('GetAppraisalStatsUseCase', () => {
  it('returns total and captadas from repo', async () => {
    const repo = makeRepo()
    repo.countByOrg.mockResolvedValue(10)
    repo.countByOrgAndStage.mockResolvedValue(0) // 'captado' never matches schema values

    const result = await new GetAppraisalStatsUseCase(repo).execute('org1')
    expect(result.total).toBe(10)
    expect(result.captadas).toBe(0)
    expect(repo.countByOrg).toHaveBeenCalledWith('org1')
    expect(repo.countByOrgAndStage).toHaveBeenCalledWith('org1', 'captado')
  })

  it('returns zeros when repo throws (graceful fallback)', async () => {
    const repo = makeRepo()
    repo.countByOrg.mockRejectedValue(new Error('table does not exist'))
    repo.countByOrgAndStage.mockResolvedValue(0)

    const result = await new GetAppraisalStatsUseCase(repo).execute('org1')
    expect(result).toEqual({ total: 0, captadas: 0 })
  })

  it('returns zeros when org has no appraisals', async () => {
    const repo = makeRepo()
    repo.countByOrg.mockResolvedValue(0)
    repo.countByOrgAndStage.mockResolvedValue(0)

    const result = await new GetAppraisalStatsUseCase(repo).execute('org1')
    expect(result).toEqual({ total: 0, captadas: 0 })
  })
})
