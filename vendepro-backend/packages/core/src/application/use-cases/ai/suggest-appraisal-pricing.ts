import type {
  AppraisalPricingContext,
  AppraisalPricingResult,
  AppraisalPricingSuggester,
} from '../../ports/services/ai-service'

export interface SuggestAppraisalPricingInput {
  property?: {
    address?: string | null
    neighborhood?: string | null
    property_type?: string | null
    weighted_area?: number | string | null
    covered_area?: number | string | null
    total_area?: number | string | null
  }
  comparables?: Array<{
    address?: string | null
    kind?: string | null
    total_area?: number | string | null
    price?: number | string | null
    closing_price_usd?: number | string | null
    usd_per_m2?: number | string | null
    days_on_market?: number | string | null
    views_per_day?: number | string | null
  }>
  swot?: { strengths?: string | null; weaknesses?: string | null }
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function fail(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/** Redondeo comercial: a los USD 1.000 más cercanos (5.000 arriba de 200k). */
export function roundPrice(v: number): number {
  const step = v >= 200_000 ? 5_000 : 1_000
  return Math.round(v / step) * step
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Sugiere los precios de la tasación desde los comparables cargados.
 *
 * División de trabajo deliberada, la misma de toda la IA del producto:
 * - La MATEMÁTICA es del código: USD/m² por comparable (con el precio de
 *   CIERRE cuando el comparable es una venta — evidencia real, no aspiración),
 *   mediana, rango, valor base por superficie ponderada.
 * - El MODELO posiciona dentro del rango y redacta la justificación. Los tres
 *   precios que devuelve se re-validan acá: clamp al rango duro y orden
 *   cierre ≤ sugerido ≤ prueba. Un LLM jamás decide un número sin red.
 */
export class SuggestAppraisalPricingUseCase {
  constructor(private readonly suggester: AppraisalPricingSuggester) {}

  async execute(input: SuggestAppraisalPricingInput): Promise<AppraisalPricingResult> {
    const weighted = num(input.property?.weighted_area) ?? num(input.property?.total_area)
    if (!weighted) {
      throw fail('Cargá la superficie de la propiedad (ponderada o total) antes de pedir precios.', 400)
    }

    const comparables = (input.comparables ?? []).map((c) => ({
      address: c.address ?? null,
      kind: c.kind === 'venta' ? 'venta' : 'publicacion',
      total_area: num(c.total_area),
      price: num(c.price),
      closing_price_usd: num(c.closing_price_usd),
      usd_per_m2: num(c.usd_per_m2),
      days_on_market: num(c.days_on_market),
      views_per_day: num(c.views_per_day),
    }))

    // USD/m² por comparable: el campo explícito gana; si no, se deriva del
    // precio (cierre para ventas, publicación para el resto) sobre su área.
    const usdM2 = comparables
      .map((c) => {
        if (c.usd_per_m2) return c.usd_per_m2
        const priceRef = c.kind === 'venta' ? (c.closing_price_usd ?? c.price) : c.price
        return priceRef && c.total_area ? priceRef / c.total_area : null
      })
      .filter((v): v is number => v !== null)

    if (usdM2.length === 0) {
      throw fail(
        'Ningún comparable tiene precio y superficie (o USD/m²). Completá al menos uno para poder sugerir.',
        400,
      )
    }

    const medianUsdM2 = median(usdM2)
    const minUsdM2 = Math.min(...usdM2)
    const maxUsdM2 = Math.max(...usdM2)
    const baseValue = roundPrice(medianUsdM2 * weighted)
    // Rango duro: del piso del mercado al techo, con 5% de aire en cada punta.
    const floorValue = roundPrice(minUsdM2 * weighted * 0.95)
    const ceilValue = roundPrice(maxUsdM2 * weighted * 1.05)

    const raw = await this.suggester.suggestAppraisalPricing({
      property: {
        address: input.property?.address ?? null,
        neighborhood: input.property?.neighborhood ?? null,
        property_type: input.property?.property_type ?? null,
        weighted_area: weighted,
        covered_area: num(input.property?.covered_area),
        total_area: num(input.property?.total_area),
      },
      stats: {
        count: usdM2.length,
        median_usd_m2: Math.round(medianUsdM2),
        min_usd_m2: Math.round(minUsdM2),
        max_usd_m2: Math.round(maxUsdM2),
        base_value: baseValue,
        floor_value: floorValue,
        ceil_value: ceilValue,
      },
      comparables,
      swot: {
        strengths: input.swot?.strengths ?? null,
        weaknesses: input.swot?.weaknesses ?? null,
      },
    })

    // Red de seguridad sobre lo que devolvió el modelo.
    let suggested = clamp(roundPrice(raw.suggested_price || baseValue), floorValue, ceilValue)
    let test = clamp(roundPrice(raw.test_price || suggested), floorValue, ceilValue)
    let close = clamp(roundPrice(raw.expected_close_price || suggested), floorValue, ceilValue)
    // Orden comercial: cierre ≤ sugerido ≤ prueba.
    if (close > suggested) close = suggested
    if (test < suggested) test = suggested

    return {
      suggested_price: suggested,
      test_price: test,
      expected_close_price: close,
      usd_per_m2: Math.round(suggested / weighted),
      rationale: (raw.rationale ?? '').trim(),
    }
  }
}
