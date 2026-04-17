import { describe, it, expect, vi } from 'vitest'
import { CreatePrefactibilidadUseCase } from '../../../src/application/use-cases/prefactibilidades/create-prefactibilidad'
import { GetPrefactibilidadesUseCase } from '../../../src/application/use-cases/prefactibilidades/get-prefactibilidades'
import { GetPrefactibilidadDetailUseCase } from '../../../src/application/use-cases/prefactibilidades/get-prefactibilidad-detail'

const mockPrefact = { id: 'pf-1', toObject: () => ({ id: 'pf-1', status: 'draft' }) }

const mockRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  findByOrg: vi.fn().mockResolvedValue([mockPrefact]),
  findById: vi.fn().mockResolvedValue(mockPrefact),
  findPublicBySlug: vi.fn(), findPublicBySlugWithOrg: vi.fn(), delete: vi.fn(),
}
const mockIdGen = { generate: vi.fn().mockReturnValue('abc123def456') }

describe('CreatePrefactibilidadUseCase', () => {
  it('creates prefactibilidad with slug and returns id', async () => {
    const useCase = new CreatePrefactibilidadUseCase(mockRepo as any, mockIdGen)
    const result = await useCase.execute({
      org_id: 'org-1',
      agent_id: 'agent-1',
      address: 'Calle Falsa 123',
    })
    expect(result.id).toBe('abc123def456')
    expect(result.slug).toBe('pf-abc123def456')
    expect(mockRepo.save).toHaveBeenCalled()
  })
})

describe('GetPrefactibilidadesUseCase', () => {
  it('returns list by org', async () => {
    const useCase = new GetPrefactibilidadesUseCase(mockRepo as any)
    const result = await useCase.execute('org-1')
    expect(result).toHaveLength(1)
    expect(mockRepo.findByOrg).toHaveBeenCalledWith('org-1')
  })
})

describe('GetPrefactibilidadDetailUseCase', () => {
  it('returns prefact when found', async () => {
    const useCase = new GetPrefactibilidadDetailUseCase(mockRepo as any)
    const result = await useCase.execute('pf-1', 'org-1')
    expect(result).toBe(mockPrefact)
  })

  it('returns null when not found', async () => {
    const noRepo = { ...mockRepo, findById: vi.fn().mockResolvedValue(null) }
    const useCase = new GetPrefactibilidadDetailUseCase(noRepo as any)
    const result = await useCase.execute('unknown', 'org-1')
    expect(result).toBeNull()
  })
})
