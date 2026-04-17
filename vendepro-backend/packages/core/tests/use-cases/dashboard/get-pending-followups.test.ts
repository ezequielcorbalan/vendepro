import { describe, it, expect, vi } from 'vitest'
import { GetPendingFollowupsUseCase } from '../../../src/application/use-cases/dashboard/get-pending-followups'

function makeRepo() {
  return {
    findById: vi.fn(),
    findByOrg: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    searchByName: vi.fn(),
    findPendingFollowups: vi.fn(),
    exportAllWithAssignedName: vi.fn(),
  }
}

describe('GetPendingFollowupsUseCase', () => {
  it('returns followups from repo', async () => {
    const repo = makeRepo()
    const mockFollowups = [
      { id: 'lead1', full_name: 'Ana García', next_step: 'Llamar', next_step_date: '2026-04-15', stage: 'contactado' },
    ]
    repo.findPendingFollowups.mockResolvedValue(mockFollowups)

    const result = await new GetPendingFollowupsUseCase(repo).execute('org1')
    expect(result).toEqual(mockFollowups)
    expect(repo.findPendingFollowups).toHaveBeenCalledWith('org1', expect.any(String), 10)
  })

  it('uses custom limit', async () => {
    const repo = makeRepo()
    repo.findPendingFollowups.mockResolvedValue([])

    await new GetPendingFollowupsUseCase(repo).execute('org1', 5)
    expect(repo.findPendingFollowups).toHaveBeenCalledWith('org1', expect.any(String), 5)
  })

  it('returns empty array on repo error', async () => {
    const repo = makeRepo()
    repo.findPendingFollowups.mockRejectedValue(new Error('table missing'))

    const result = await new GetPendingFollowupsUseCase(repo).execute('org1')
    expect(result).toEqual([])
  })
})
