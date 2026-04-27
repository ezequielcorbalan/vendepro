/**
 * Cálculo de superficie ponderada según pesos configurables por inmobiliaria.
 *
 * ponderada = cubierta · W_cub + semi · W_semi + descubierta · W_desc
 * donde descubierta = max(0, total − cubierta − semi)
 *
 * Defaults estándar AR: 100% / 75% / 25%.
 * Cada inmobiliaria puede ajustar sus pesos en Configuración → Marca.
 */

export interface SurfaceWeights {
  covered: number
  semi: number
  uncovered: number
}

export const DEFAULT_SURFACE_WEIGHTS: SurfaceWeights = {
  covered: 1,
  semi: 0.75,
  uncovered: 0.25,
}

export function isValidWeights(w: unknown): w is SurfaceWeights {
  if (typeof w !== 'object' || w === null) return false
  const x = w as Record<string, unknown>
  return typeof x.covered === 'number' && typeof x.semi === 'number' && typeof x.uncovered === 'number'
}

/**
 * Calcula la superficie ponderada. Devuelve `null` si no hay datos suficientes.
 * (Necesita al menos cubierta o total para tener un resultado significativo).
 */
export function calcWeightedArea(
  covered: number | null | undefined,
  semi: number | null | undefined,
  total: number | null | undefined,
  weights: SurfaceWeights = DEFAULT_SURFACE_WEIGHTS,
): number | null {
  const c = Number(covered) || 0
  const s = Number(semi) || 0
  const t = Number(total) || 0
  if (c <= 0 && t <= 0) return null
  const uncovered = Math.max(0, t - c - s)
  const result = c * weights.covered + s * weights.semi + uncovered * weights.uncovered
  return Math.round(result * 100) / 100
}
