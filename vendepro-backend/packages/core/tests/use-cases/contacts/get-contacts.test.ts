import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetContactsUseCase } from '../../../src/application/use-cases/contacts/get-contacts'
import { Contact } from '../../../src/domain/entities/contact'

const contactA = Contact.create({
  id: 'contact-a',
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

const contactB = Contact.create({
  id: 'contact-b',
  org_id: 'org_mg',
  full_name: 'Bruno Díaz',
  phone: null,
  email: 'bruno@mail.com',
  contact_type: 'comprador',
  neighborhood: null,
  source: 'zonaprop',
  notes: null,
  agent_id: 'agent-1',
})

const mockContactRepo = {
  findByOrg: vi.fn(),
} as any

const mockTagRepo = {
  findByContactIds: vi.fn(),
} as any

describe('GetContactsUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sin tagRepo devuelve los contactos planos sin tags', async () => {
    mockContactRepo.findByOrg.mockResolvedValue([contactA])

    const useCase = new GetContactsUseCase(mockContactRepo)
    const result = await useCase.execute('org_mg')

    expect(result.length).toBe(1)
    expect(result[0]!.full_name).toBe('Ana López')
    expect(result[0]!.tags).toBeUndefined()
  })

  it('con tagRepo adjunta los tags de cada contacto (vacío si no tiene)', async () => {
    mockContactRepo.findByOrg.mockResolvedValue([contactA, contactB])
    mockTagRepo.findByContactIds.mockResolvedValue({
      'contact-a': [{ id: 'tag-1', name: 'inversor', color: '#6366f1' }],
    })

    const useCase = new GetContactsUseCase(mockContactRepo, mockTagRepo)
    const result = await useCase.execute('org_mg')

    expect(mockTagRepo.findByContactIds).toHaveBeenCalledWith(['contact-a', 'contact-b'], 'org_mg')
    expect(result[0]!.tags).toEqual([{ id: 'tag-1', name: 'inversor', color: '#6366f1' }])
    expect(result[1]!.tags).toEqual([])
  })

  it('pasa los filtros (incluido tag_id) al repositorio', async () => {
    mockContactRepo.findByOrg.mockResolvedValue([])

    const useCase = new GetContactsUseCase(mockContactRepo, mockTagRepo)
    await useCase.execute('org_mg', { search: 'ana', tag_id: 'tag-9' })

    expect(mockContactRepo.findByOrg).toHaveBeenCalledWith('org_mg', { search: 'ana', tag_id: 'tag-9' })
    expect(mockTagRepo.findByContactIds).not.toHaveBeenCalled()
  })
})
