import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LinkLeadPropertyUseCase } from '../../../src/application/use-cases/lead-properties/link-lead-property'
import { UpdateLeadPropertyStatusUseCase } from '../../../src/application/use-cases/lead-properties/update-lead-property-status'
import { UnlinkLeadPropertyUseCase } from '../../../src/application/use-cases/lead-properties/unlink-lead-property'
import { GetLeadPropertiesUseCase } from '../../../src/application/use-cases/lead-properties/get-lead-properties'
import { GetPropertyInterestedLeadsUseCase } from '../../../src/application/use-cases/lead-properties/get-property-interested-leads'
import { LeadProperty } from '../../../src/domain/entities/lead-property'
import { NotFoundError } from '../../../src/domain/errors/not-found'

const makeLeadProperty = (over: Partial<Parameters<typeof LeadProperty.create>[0]> = {}) =>
  LeadProperty.create({
    id: 'lp-1',
    org_id: 'org_mg',
    lead_id: 'lead-1',
    property_id: 'prop-1',
    notes: null,
    feedback: null,
    ...over,
  })

const mockLeadPropertyRepo = {
  findById: vi.fn(),
  findByLead: vi.fn(),
  findByLeadAndProperty: vi.fn(),
  findByLeadWithProperty: vi.fn(),
  findInterestedByProperty: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
}
const mockLeadRepo = { findById: vi.fn() } as any
const mockPropertyRepo = { findById: vi.fn() } as any
const mockIdGen = { generate: vi.fn().mockReturnValue('lp-new') }

beforeEach(() => {
  vi.clearAllMocks()
  mockLeadPropertyRepo.save.mockResolvedValue(undefined)
  mockLeadPropertyRepo.delete.mockResolvedValue(undefined)
})

describe('LinkLeadPropertyUseCase', () => {
  const useCase = () => new LinkLeadPropertyUseCase(mockLeadPropertyRepo as any, mockLeadRepo, mockPropertyRepo, mockIdGen)

  it('crea la relación con status interesado', async () => {
    mockLeadRepo.findById.mockResolvedValue({ id: 'lead-1' })
    mockPropertyRepo.findById.mockResolvedValue({ id: 'prop-1' })
    mockLeadPropertyRepo.findByLeadAndProperty.mockResolvedValue(null)

    const result = await useCase().execute({ orgId: 'org_mg', leadId: 'lead-1', propertyId: 'prop-1' })

    expect(result).toEqual({ id: 'lp-new', created: true })
    expect(mockLeadPropertyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'interesado', lead_id: 'lead-1', property_id: 'prop-1' })
    )
  })

  it('es idempotente: si la relación existe no la duplica ni toca su status', async () => {
    mockLeadRepo.findById.mockResolvedValue({ id: 'lead-1' })
    mockPropertyRepo.findById.mockResolvedValue({ id: 'prop-1' })
    mockLeadPropertyRepo.findByLeadAndProperty.mockResolvedValue(makeLeadProperty({ status: 'visitada' }))

    const result = await useCase().execute({ orgId: 'org_mg', leadId: 'lead-1', propertyId: 'prop-1' })

    expect(result).toEqual({ id: 'lp-1', created: false })
    expect(mockLeadPropertyRepo.save).not.toHaveBeenCalled()
  })

  it('falla si el lead no existe', async () => {
    mockLeadRepo.findById.mockResolvedValue(null)
    await expect(useCase().execute({ orgId: 'org_mg', leadId: 'x', propertyId: 'prop-1' }))
      .rejects.toThrow(NotFoundError)
  })

  it('falla si la propiedad no existe', async () => {
    mockLeadRepo.findById.mockResolvedValue({ id: 'lead-1' })
    mockPropertyRepo.findById.mockResolvedValue(null)
    await expect(useCase().execute({ orgId: 'org_mg', leadId: 'lead-1', propertyId: 'x' }))
      .rejects.toThrow(NotFoundError)
  })
})

describe('UpdateLeadPropertyStatusUseCase', () => {
  const useCase = () => new UpdateLeadPropertyStatusUseCase(mockLeadPropertyRepo as any)

  it('actualiza status y feedback', async () => {
    const lp = makeLeadProperty()
    mockLeadPropertyRepo.findById.mockResolvedValue(lp)

    await useCase().execute({ orgId: 'org_mg', id: 'lp-1', status: 'visitada', feedback: 'precio alto' })

    expect(lp.status).toBe('visitada')
    expect(lp.feedback).toBe('precio alto')
    expect(mockLeadPropertyRepo.save).toHaveBeenCalledWith(lp)
  })

  it('actualiza solo notas sin tocar status', async () => {
    const lp = makeLeadProperty({ status: 'oferto' })
    mockLeadPropertyRepo.findById.mockResolvedValue(lp)

    await useCase().execute({ orgId: 'org_mg', id: 'lp-1', notes: 'nota nueva' })

    expect(lp.status).toBe('oferto')
    expect(lp.notes).toBe('nota nueva')
  })

  it('falla si la relación no existe', async () => {
    mockLeadPropertyRepo.findById.mockResolvedValue(null)
    await expect(useCase().execute({ orgId: 'org_mg', id: 'missing', status: 'visitada' }))
      .rejects.toThrow(NotFoundError)
  })
})

describe('UnlinkLeadPropertyUseCase', () => {
  it('elimina la relación existente', async () => {
    mockLeadPropertyRepo.findById.mockResolvedValue(makeLeadProperty())
    const useCase = new UnlinkLeadPropertyUseCase(mockLeadPropertyRepo as any)
    await useCase.execute({ orgId: 'org_mg', id: 'lp-1' })
    expect(mockLeadPropertyRepo.delete).toHaveBeenCalledWith('lp-1', 'org_mg')
  })

  it('falla si no existe', async () => {
    mockLeadPropertyRepo.findById.mockResolvedValue(null)
    const useCase = new UnlinkLeadPropertyUseCase(mockLeadPropertyRepo as any)
    await expect(useCase.execute({ orgId: 'org_mg', id: 'missing' })).rejects.toThrow(NotFoundError)
  })
})

describe('GetLeadPropertiesUseCase / GetPropertyInterestedLeadsUseCase', () => {
  it('devuelve las propiedades de interés del lead', async () => {
    const rows = [{ id: 'lp-1', property_address: 'Av. Cabildo 1234' }]
    mockLeadPropertyRepo.findByLeadWithProperty.mockResolvedValue(rows)
    const useCase = new GetLeadPropertiesUseCase(mockLeadPropertyRepo as any)
    expect(await useCase.execute({ orgId: 'org_mg', leadId: 'lead-1' })).toBe(rows)
  })

  it('devuelve los interesados de la propiedad', async () => {
    const rows = [{ id: 'lp-1', lead_full_name: 'Comprador Test' }]
    mockLeadPropertyRepo.findInterestedByProperty.mockResolvedValue(rows)
    const useCase = new GetPropertyInterestedLeadsUseCase(mockLeadPropertyRepo as any)
    expect(await useCase.execute({ orgId: 'org_mg', propertyId: 'prop-1' })).toBe(rows)
  })
})
