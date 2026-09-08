import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateReportConclusionUseCase } from '../../../src/application/use-cases/ai/generate-report-conclusion'

const generator = () => ({
  generateReportConclusion: vi.fn().mockResolvedValue({
    conclusion: 'El aviso tuvo buena tracción...',
    price_reference: null,
  }),
}) as any

beforeEach(() => vi.clearAllMocks())

describe('GenerateReportConclusionUseCase', () => {
  const baseInput = {
    periodLabel: 'Agosto 2026',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    metrics: [
      // Strings a propósito: el wizard manda los inputs sin convertir.
      { source: 'zonaprop', portal_visits: '600', inquiries: '12', impressions: '' },
    ],
    competitors: [
      { address: 'Aguirre 900', price: '95000', notes: 'similar' },
      { address: '', price: '', notes: '' }, // fila vacía del wizard
    ],
  }

  it('calcula el semáforo con la regla de dominio y se lo da masticado al modelo', async () => {
    const g = generator()
    const uc = new GenerateReportConclusionUseCase(g)
    const result = await uc.execute(baseInput)

    expect(result.conclusion).toContain('tracción')
    const ctx = g.generateReportConclusion.mock.calls[0][0]
    expect(ctx.daysInPeriod).toBe(30)
    expect(ctx.viewsPerDay).toBe(20) // 600 / 30
    expect(ctx.healthLabel).toContain('amarillo')
    // Números saneados: strings → number, vacío → null.
    expect(ctx.metrics[0].portal_visits).toBe(600)
    expect(ctx.metrics[0].impressions).toBeNull()
    // La fila vacía de competencia no viaja.
    expect(ctx.competitors).toHaveLength(1)
    expect(ctx.competitors[0].price).toBe(95000)
  })

  it('400 sin ninguna métrica cargada — y no llama al modelo', async () => {
    const g = generator()
    const uc = new GenerateReportConclusionUseCase(g)
    await expect(uc.execute({ ...baseInput, metrics: [{ source: 'zonaprop' }] }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(uc.execute({ ...baseInput, metrics: [] }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(g.generateReportConclusion).not.toHaveBeenCalled()
  })

  it('sin período no inventa tasas: viewsPerDay y semáforo van null', async () => {
    const g = generator()
    const uc = new GenerateReportConclusionUseCase(g)
    await uc.execute({ ...baseInput, periodStart: undefined, periodEnd: undefined })
    const ctx = g.generateReportConclusion.mock.calls[0][0]
    expect(ctx.viewsPerDay).toBeNull()
    expect(ctx.healthLabel).toBeNull()
  })
})
