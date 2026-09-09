import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateReportUseCase } from '../../../src/application/use-cases/reports/update-report'

let idCounter = 0
const idGen = { generate: vi.fn().mockImplementation(() => `gen-${++idCounter}`) } as any

const baseRow = {
  id: 'rep-1', property_id: 'prop-1', period_label: 'Abril 2026',
  period_start: '2026-04-01', period_end: '2026-04-30',
  status: 'draft', created_by: 'user-1', created_at: '2026-04-01T00:00:00Z',
  published_at: null, public_slug: 'corrientes-abril-abc123',
}

const repo = () => ({
  findReportRaw: vi.fn().mockResolvedValue({ ...baseRow }),
  save: vi.fn().mockResolvedValue(undefined),
  replaceMetrics: vi.fn().mockResolvedValue(undefined),
  replaceContent: vi.fn().mockResolvedValue(undefined),
  deleteCompetitorLinks: vi.fn().mockResolvedValue(undefined),
  addCompetitorLink: vi.fn().mockResolvedValue(undefined),
}) as any

const propertyRepo = { findById: vi.fn().mockResolvedValue({ toObject: () => ({ address: 'X' }) }) } as any

const baseInput = {
  id: 'rep-1', orgId: 'org-1', userId: 'user-1', userRole: 'agent' as const,
}

beforeEach(() => { idCounter = 0; vi.clearAllMocks() })

describe('UpdateReportUseCase · competitors', () => {
  it('reemplaza los links de competencia — el PUT los ignoraba y la edición se perdía', async () => {
    const r = repo()
    const uc = new UpdateReportUseCase(r, propertyRepo, idGen)
    await uc.execute({
      ...baseInput,
      competitors: [
        { url: 'https://www.zonaprop.com.ar/x.html', address: 'Aguirre 900', price: 95000, notes: 'similar' },
      ],
    })
    // Scopeado a la property del REPORTE (los links son por propiedad).
    expect(r.deleteCompetitorLinks).toHaveBeenCalledWith('prop-1', 'org-1')
    expect(r.addCompetitorLink).toHaveBeenCalledWith(expect.objectContaining({
      property_id: 'prop-1',
      url: 'https://www.zonaprop.com.ar/x.html',
      price: 95000,
    }), 'org-1')
  })

  it('competitors: [] borra todos (sacaste la última de la lista)', async () => {
    const r = repo()
    const uc = new UpdateReportUseCase(r, propertyRepo, idGen)
    await uc.execute({ ...baseInput, competitors: [] })
    expect(r.deleteCompetitorLinks).toHaveBeenCalledWith('prop-1', 'org-1')
    expect(r.addCompetitorLink).not.toHaveBeenCalled()
  })

  it('sin el campo competitors no toca nada (PUT parcial)', async () => {
    const r = repo()
    const uc = new UpdateReportUseCase(r, propertyRepo, idGen)
    await uc.execute({ ...baseInput })
    expect(r.deleteCompetitorLinks).not.toHaveBeenCalled()
  })

  it('las filas vacías del wizard no se guardan como links', async () => {
    const r = repo()
    const uc = new UpdateReportUseCase(r, propertyRepo, idGen)
    await uc.execute({
      ...baseInput,
      competitors: [{ url: '', address: '', price: null, notes: '' }],
    })
    expect(r.addCompetitorLink).not.toHaveBeenCalled()
  })
})

describe('UpdateReportUseCase · permisos', () => {
  it('un agente no puede editar el reporte de otro; un admin sí', async () => {
    const r = repo()
    const uc = new UpdateReportUseCase(r, propertyRepo, idGen)
    await expect(uc.execute({ ...baseInput, userId: 'otro-user' }))
      .rejects.toMatchObject({ statusCode: 403 })
    await expect(uc.execute({ ...baseInput, userId: 'otro-user', userRole: 'admin' }))
      .resolves.toMatchObject({ success: true })
  })
})
