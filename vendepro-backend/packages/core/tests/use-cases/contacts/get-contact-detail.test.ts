import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetContactDetailUseCase } from '../../../src/application/use-cases/contacts/get-contact-detail'
import { Contact } from '../../../src/domain/entities/contact'

const mockContact = Contact.create({
  id: 'contact-1',
  org_id: 'org_mg',
  full_name: 'Ana López',
  phone: '1134567890',
  email: null,
  contact_type: 'propietario',
  neighborhood: 'Palermo',
  source: null,
  notes: null,
  agent_id: 'agent-1',
})

const mockRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  findWithLeadsAndProperties: vi.fn(),
}

describe('GetContactDetailUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns contact with leads and properties when found', async () => {
    const payload = {
      contact: mockContact,
      leads: [{ id: 'lead-1', full_name: 'Ana López', stage: 'nuevo' }],
      properties: [{ id: 'prop-1', address: 'Av. Corrientes 1234', status: 'active' }],
    }
    mockRepo.findWithLeadsAndProperties.mockResolvedValue(payload)

    const useCase = new GetContactDetailUseCase(mockRepo)
    const result = await useCase.execute('contact-1', 'org_mg')

    expect(result).toBe(payload)
    expect(mockRepo.findWithLeadsAndProperties).toHaveBeenCalledWith('contact-1', 'org_mg')
  })

  it('returns null when contact not found', async () => {
    mockRepo.findWithLeadsAndProperties.mockResolvedValue(null)

    const useCase = new GetContactDetailUseCase(mockRepo)
    const result = await useCase.execute('nonexistent', 'org_mg')

    expect(result).toBeNull()
  })
})
