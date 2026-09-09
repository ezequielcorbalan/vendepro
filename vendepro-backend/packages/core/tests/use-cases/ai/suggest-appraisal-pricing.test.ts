import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SuggestAppraisalPricingUseCase,
  median,
  roundPrice,
} from '../../../src/application/use-cases/ai/suggest-appraisal-pricing'

const suggester = (result?: Partial<{ suggested_price: number; test_price: number; expected_close_price: number; rationale: string }>) => ({
  suggestAppraisalPricing: vi.fn().mockResolvedValue({
    suggested_price: 100_000,
    test_price: 105_000,
    expected_close_price: 95_000,
    usd_per_m2: 0,
    rationale: 'La mediana de la zona...',
    ...result,
  }),
}) as any

beforeEach(() => vi.clearAllMocks())

const baseInput = {
  property: { address: 'Juramento 2300', neighborhood: 'Belgrano', property_type: 'departamento', weighted_area: 50 },
  comparables: [
    // usd_per_m2 explícito
    { address: 'A', kind: 'publicacion', usd_per_m2: 2000 },
    // derivado de precio de publicación / área: 210000/100 = 2100
    { address: 'B', kind: 'publicacion', price: 210_000, total_area: 100 },
    // VENTA: manda el precio de CIERRE (1900), no el de publicación
    { address: 'C', kind: 'venta', price: 230_000, closing_price_usd: 190_000, total_area: 100 },
  ],
  swot: { strengths: 'luminoso', weaknesses: 'sin cochera' },
}

describe('median / roundPrice', () => {
  it('mediana impar y par', () => {
    expect(median([1900, 2000, 2100])).toBe(2000)
    expect(median([1000, 2000])).toBe(1500)
  })
  it('redondeo comercial: 1000 abajo de 200k, 5000 arriba', () => {
    expect(roundPrice(99_400)).toBe(99_000)
    expect(roundPrice(99_600)).toBe(100_000)
    expect(roundPrice(212_400)).toBe(210_000)
  })
})

describe('SuggestAppraisalPricingUseCase', () => {
  it('calcula la estadística en código y se la da masticada al modelo', async () => {
    const g = suggester()
    const uc = new SuggestAppraisalPricingUseCase(g)
    await uc.execute(baseInput)

    const ctx = g.suggestAppraisalPricing.mock.calls[0][0]
    // USD/m²: 2000 (explícito), 2100 (derivado), 1900 (cierre de la venta) → mediana 2000
    expect(ctx.stats.median_usd_m2).toBe(2000)
    expect(ctx.stats.min_usd_m2).toBe(1900)
    expect(ctx.stats.max_usd_m2).toBe(2100)
    expect(ctx.stats.count).toBe(3)
    // base = 2000 × 50 m² = 100.000
    expect(ctx.stats.base_value).toBe(100_000)
    // rango duro: 1900×50×0.95 y 2100×50×1.05
    expect(ctx.stats.floor_value).toBe(90_000)
    expect(ctx.stats.ceil_value).toBe(110_000)
  })

  it('clampa lo que devuelve el modelo al rango duro y recalcula USD/m²', async () => {
    // El modelo se fue de mambo: 500k en una zona de ~100k.
    const uc = new SuggestAppraisalPricingUseCase(suggester({
      suggested_price: 500_000, test_price: 600_000, expected_close_price: 20_000,
    }))
    const r = await uc.execute(baseInput)
    expect(r.suggested_price).toBe(110_000) // techo
    expect(r.test_price).toBe(110_000)
    expect(r.expected_close_price).toBe(90_000) // piso
    expect(r.usd_per_m2).toBe(Math.round(110_000 / 50))
  })

  it('fuerza el orden comercial: cierre ≤ sugerido ≤ prueba', async () => {
    const uc = new SuggestAppraisalPricingUseCase(suggester({
      suggested_price: 100_000, test_price: 92_000, expected_close_price: 108_000,
    }))
    const r = await uc.execute(baseInput)
    expect(r.expected_close_price).toBeLessThanOrEqual(r.suggested_price)
    expect(r.test_price).toBeGreaterThanOrEqual(r.suggested_price)
  })

  it('400 sin superficie o sin comparables usables — y no llama al modelo', async () => {
    const g = suggester()
    const uc = new SuggestAppraisalPricingUseCase(g)
    await expect(uc.execute({ ...baseInput, property: { weighted_area: null } }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(uc.execute({
      ...baseInput,
      comparables: [{ address: 'X', kind: 'publicacion' }], // sin precio ni área
    })).rejects.toMatchObject({ statusCode: 400 })
    expect(g.suggestAppraisalPricing).not.toHaveBeenCalled()
  })

  it('acepta strings del formulario y cae a total_area sin ponderada', async () => {
    const g = suggester()
    const uc = new SuggestAppraisalPricingUseCase(g)
    await uc.execute({
      property: { weighted_area: '', total_area: '50' },
      comparables: [{ kind: 'publicacion', usd_per_m2: '2000' }],
    })
    const ctx = g.suggestAppraisalPricing.mock.calls[0][0]
    expect(ctx.property.weighted_area).toBe(50)
    expect(ctx.stats.base_value).toBe(100_000)
  })
})
