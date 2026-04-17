import { describe, it, expect, vi } from 'vitest'
import { CreateReportUseCase } from '../../../src/application/use-cases/reports/create-report'
import { GetReportsUseCase } from '../../../src/application/use-cases/reports/get-reports'

const mockReport = { id: 'rep-1', toObject: () => ({ id: 'rep-1', status: 'draft' }) }

let idCounter = 0
const mockIdGen = { generate: vi.fn().mockImplementation(() => `gen-id-${++idCounter}`) }

const mockRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  findByOrg: vi.fn().mockResolvedValue([mockReport]),
  findById: vi.fn(), findByProperty: vi.fn(), findPublicBySlug: vi.fn(),
  findLatestPublishedByProperty: vi.fn(), delete: vi.fn(),
  findMetrics: vi.fn().mockResolvedValue([]),
  findContent: vi.fn().mockResolvedValue([]),
  replaceMetrics: vi.fn().mockResolvedValue(undefined),
  replaceContent: vi.fn().mockResolvedValue(undefined),
  findReportRaw: vi.fn(),
  deleteCompetitorLinks: vi.fn().mockResolvedValue(undefined),
  addCompetitorLink: vi.fn().mockResolvedValue(undefined),
  findCompetitorLinks: vi.fn().mockResolvedValue([]),
  findPhotosByReport: vi.fn().mockResolvedValue([]),
}

describe('CreateReportUseCase', () => {
  beforeEach(() => { idCounter = 0; vi.clearAllMocks() })

  it('creates report and saves metrics + content', async () => {
    const useCase = new CreateReportUseCase(mockRepo as any, mockIdGen)
    const result = await useCase.execute({
      propertyId: 'prop-1',
      periodLabel: 'Abril 2026',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      createdBy: 'user-1',
      metrics: [{ source: 'zonaprop', impressions: 1200 }],
      strategy: 'Precio competitivo',
    })
    expect(result.reportId).toBeDefined()
    expect(result.propertyId).toBe('prop-1')
    expect(mockRepo.save).toHaveBeenCalled()
    expect(mockRepo.replaceMetrics).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([
      expect.objectContaining({ source: 'zonaprop', impressions: 1200 }),
    ]))
    expect(mockRepo.replaceContent).toHaveBeenCalled()
  })

  it('handles competitors when provided', async () => {
    const useCase = new CreateReportUseCase(mockRepo as any, mockIdGen)
    await useCase.execute({
      propertyId: 'prop-1',
      periodLabel: 'Abril 2026',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      createdBy: 'user-1',
      competitors: [{ url: 'https://zonaprop.com/123', address: 'Calle 1', price: 180000 }],
    })
    expect(mockRepo.deleteCompetitorLinks).toHaveBeenCalledWith('prop-1')
    expect(mockRepo.addCompetitorLink).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://zonaprop.com/123' }))
  })
})

describe('GetReportsUseCase', () => {
  it('returns reports for org', async () => {
    const useCase = new GetReportsUseCase(mockRepo as any)
    const result = await useCase.execute('org-1')
    expect(result).toHaveLength(1)
    expect(mockRepo.findByOrg).toHaveBeenCalledWith('org-1', undefined)
  })

  it('passes propertyId filter when provided', async () => {
    const useCase = new GetReportsUseCase(mockRepo as any)
    await useCase.execute('org-1', 'prop-1')
    expect(mockRepo.findByOrg).toHaveBeenCalledWith('org-1', 'prop-1')
  })
})
