import { describe, it, expect, vi } from 'vitest'
import { ExportLeadsUseCase } from '../../../src/application/use-cases/analytics/export-leads'

function makeRepo() {
  return {
    findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
    searchByName: vi.fn(), findPendingFollowups: vi.fn(), exportAllWithAssignedName: vi.fn(),
  }
}

describe('ExportLeadsUseCase', () => {
  it('returns raw rows from repo', async () => {
    const repo = makeRepo()
    const mockRows = [
      { id: 'l1', full_name: 'Ana García', assigned_name: 'Pedro Agent' },
      { id: 'l2', full_name: 'Luis Mora', assigned_name: null },
    ]
    repo.exportAllWithAssignedName.mockResolvedValue(mockRows)

    const result = await new ExportLeadsUseCase(repo).execute('org1')
    expect(result).toEqual(mockRows)
    expect(repo.exportAllWithAssignedName).toHaveBeenCalledWith('org1')
  })

  it('returns empty array when no leads exist', async () => {
    const repo = makeRepo()
    repo.exportAllWithAssignedName.mockResolvedValue([])

    const result = await new ExportLeadsUseCase(repo).execute('org1')
    expect(result).toEqual([])
  })
})
