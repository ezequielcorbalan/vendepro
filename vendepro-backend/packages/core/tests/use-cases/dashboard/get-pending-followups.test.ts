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
      { id: 'lead1', full_name: 'Ana García', next_step: 'Llamar', next_step_date: '2026-04-15', stage: 'contactado', pipeline: 'vendedor' },
    ]
    repo.findPendingFollowups.mockResolvedValue(mockFollowups)

    const result = await new GetPendingFollowupsUseCase(repo).execute('org1')
    expect(result).toEqual(mockFollowups)
    expect(repo.findPendingFollowups).toHaveBeenCalledWith('org1', expect.any(String), 10, 'vendedor')
  })

  // El default importa: es el que usa el dashboard de captación, y sin él
  // los seguimientos de compradores volvían a colarse ahí.
  it('defaults to the seller pipeline', async () => {
    const repo = makeRepo()
    repo.findPendingFollowups.mockResolvedValue([])

    await new GetPendingFollowupsUseCase(repo).execute('org1')
    expect(repo.findPendingFollowups).toHaveBeenCalledWith('org1', expect.any(String), 10, 'vendedor')
  })

  it('asks for the buyer pipeline when requested', async () => {
    const repo = makeRepo()
    repo.findPendingFollowups.mockResolvedValue([])

    await new GetPendingFollowupsUseCase(repo).execute('org1', 'comprador')
    expect(repo.findPendingFollowups).toHaveBeenCalledWith('org1', expect.any(String), 10, 'comprador')
  })

  it('uses custom limit', async () => {
    const repo = makeRepo()
    repo.findPendingFollowups.mockResolvedValue([])

    await new GetPendingFollowupsUseCase(repo).execute('org1', 'vendedor', 5)
    expect(repo.findPendingFollowups).toHaveBeenCalledWith('org1', expect.any(String), 5, 'vendedor')
  })

  it('returns empty array on repo error', async () => {
    const repo = makeRepo()
    repo.findPendingFollowups.mockRejectedValue(new Error('table missing'))

    const result = await new GetPendingFollowupsUseCase(repo).execute('org1')
    expect(result).toEqual([])
  })
})
