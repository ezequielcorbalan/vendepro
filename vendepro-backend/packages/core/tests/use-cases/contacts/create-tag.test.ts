import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateTagUseCase } from '../../../src/application/use-cases/contacts/create-tag'

const mockRepo = {
  findByOrg: vi.fn(),
  findByLead: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  addToLead: vi.fn(),
  removeFromLead: vi.fn(),
  delete: vi.fn(),
}

const mockIds = { generate: vi.fn().mockReturnValue('tag-gen-id') }

describe('CreateTagUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIds.generate.mockReturnValue('tag-gen-id')
    mockRepo.save.mockResolvedValue(undefined)
  })

  it('creates tag and returns id', async () => {
    const useCase = new CreateTagUseCase(mockRepo, mockIds)
    const result = await useCase.execute({
      org_id: 'org_mg',
      name: 'Urgente',
      color: '#ff0000',
    })

    expect(result.id).toBe('tag-gen-id')
    expect(mockRepo.save).toHaveBeenCalledTimes(1)
    const savedTag = mockRepo.save.mock.calls[0][0]
    expect(savedTag.name).toBe('Urgente')
    expect(savedTag.color).toBe('#ff0000')
  })

  it('uses default color #6366f1 when color not provided', async () => {
    const useCase = new CreateTagUseCase(mockRepo, mockIds)
    await useCase.execute({
      org_id: 'org_mg',
      name: 'Sin Color',
    })

    const savedTag = mockRepo.save.mock.calls[0][0]
    expect(savedTag.color).toBe('#6366f1')
  })

  it('creates tag with correct org_id and is_default=0', async () => {
    const useCase = new CreateTagUseCase(mockRepo, mockIds)
    await useCase.execute({
      org_id: 'org_mg',
      name: 'Nuevo Tag',
    })

    const savedTag = mockRepo.save.mock.calls[0][0]
    expect(savedTag.org_id).toBe('org_mg')
    expect(savedTag.is_default).toBe(0)
  })
})
