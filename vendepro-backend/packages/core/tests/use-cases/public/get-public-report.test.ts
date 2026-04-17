import { describe, it, expect, vi } from 'vitest'
import { GetPublicReportUseCase } from '../../../src/application/use-cases/public/get-public-report'
import { Property } from '../../../src/domain/entities/property'
import { Report } from '../../../src/domain/entities/report'

const makeProperty = () =>
  Property.create({
    id: 'prop-1',
    org_id: 'org-1',
    address: 'Av. Libertador 100',
    neighborhood: 'Palermo',
    city: 'Buenos Aires',
    property_type: 'departamento',
    rooms: 3,
    size_m2: 80,
    asking_price: 150000,
    currency: 'USD',
    owner_name: 'Juan',
    owner_phone: null,
    owner_email: null,
    contact_id: null,
    public_slug: 'libertador-100',
    cover_photo: null,
    agent_id: 'agent-1',
    status: 'active',
    commercial_stage: null,
    operation_type: 'venta',
    operation_type_id: 1,
    commercial_stage_id: null,
    status_id: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  })

const makeReport = () =>
  Report.create({
    id: 'report-1',
    property_id: 'prop-1',
    period_label: 'Enero 2024',
    period_start: '2024-01-01',
    period_end: '2024-01-31',
    status: 'published',
    created_by: 'agent-1',
    published_at: '2024-01-15T00:00:00.000Z',
  })

describe('GetPublicReportUseCase', () => {
  it('returns property and latest published report when both exist', async () => {
    const propertyRepo = { findByPublicSlug: vi.fn().mockResolvedValue(makeProperty()) } as any
    const reportRepo = { findLatestPublishedByProperty: vi.fn().mockResolvedValue(makeReport()) } as any

    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo)
    const result = await uc.execute('libertador-100')

    expect(result).not.toBeNull()
    expect(result!.property.id).toBe('prop-1')
    expect(result!.report).not.toBeNull()
    expect(result!.report!.id).toBe('report-1')
    expect(reportRepo.findLatestPublishedByProperty).toHaveBeenCalledWith('prop-1')
  })

  it('returns null when property not found', async () => {
    const propertyRepo = { findByPublicSlug: vi.fn().mockResolvedValue(null) } as any
    const reportRepo = { findLatestPublishedByProperty: vi.fn() } as any

    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo)
    const result = await uc.execute('no-such-slug')

    expect(result).toBeNull()
    expect(reportRepo.findLatestPublishedByProperty).not.toHaveBeenCalled()
  })

  it('returns property with null report when no published report exists', async () => {
    const propertyRepo = { findByPublicSlug: vi.fn().mockResolvedValue(makeProperty()) } as any
    const reportRepo = { findLatestPublishedByProperty: vi.fn().mockResolvedValue(null) } as any

    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo)
    const result = await uc.execute('libertador-100')

    expect(result).not.toBeNull()
    expect(result!.property.id).toBe('prop-1')
    expect(result!.report).toBeNull()
  })
})
