/**
 * Ingresos de la inmobiliaria por operación cerrada, y el ROI que sale de
 * cruzarlos contra lo que se gastó para conseguir esa operación.
 *
 * Mismas dos reglas de plata que el gasto de portales, por las mismas razones:
 * la cotización viaja congelada con cada fila, y lo que no se pudo convertir no
 * suma al total en silencio.
 */

export interface PropertyIncomeRow {
  property_id: string
  /** Fuente a la que se le atribuye el ingreso (portal, campaña, etc.). */
  attribution: string | null
  commission_amount: number | null
  commission_currency: string | null
  /** Unidades de `commission_currency` por 1 USD. `null` = pendiente. */
  commission_usd_rate: number | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Honorarios en USD, o `null` si falta el importe o la cotización. */
export function commissionUsd(row: {
  commission_amount: number | null
  commission_currency: string | null
  commission_usd_rate: number | null
}): number | null {
  if (row.commission_amount === null || !Number.isFinite(row.commission_amount)) return null
  const currency = (row.commission_currency ?? 'USD').toUpperCase()
  if (currency === 'USD') return round2(row.commission_amount)
  const rate = row.commission_usd_rate
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return null
  return round2(row.commission_amount / rate)
}

export interface IncomeByAttribution {
  /** Ingreso convertido, por fuente. Sólo entra lo que se pudo convertir. */
  byAttribution: Map<string, { income_usd: number; operations: number }>
  /** Cierres cuyos honorarios no se pudieron convertir (falta cotización). */
  pending_rate: number
  /** Cierres sin fuente atribuida: entraron, pero no se sabe quién los trajo. */
  unattributed: { income_usd: number; operations: number }
}

/**
 * Agrupa los ingresos por fuente.
 *
 * Los cierres sin atribución NO se reparten ni se descartan: se cuentan aparte.
 * Repartirlos inflaría el ROI de todos los canales, y esconderlos haría que la
 * suma de la tabla no dé el total real de lo que entró.
 */
export function aggregateIncome(rows: PropertyIncomeRow[]): IncomeByAttribution {
  const byAttribution = new Map<string, { income_usd: number; operations: number }>()
  const unattributed = { income_usd: 0, operations: 0 }
  let pending = 0

  for (const row of rows) {
    const usd = commissionUsd(row)
    if (usd === null) { pending++; continue }

    if (!row.attribution) {
      unattributed.income_usd = round2(unattributed.income_usd + usd)
      unattributed.operations += 1
      continue
    }

    const entry = byAttribution.get(row.attribution) ?? { income_usd: 0, operations: 0 }
    entry.income_usd = round2(entry.income_usd + usd)
    entry.operations += 1
    byAttribution.set(row.attribution, entry)
  }

  return { byAttribution, pending_rate: pending, unattributed }
}

/**
 * Retorno sobre lo invertido, en porcentaje: (ingreso − gasto) / gasto.
 *
 * `null` cuando no hay gasto contra qué medirlo. Un ROI sin gasto no es
 * infinito ni cero: no existe, y mostrarlo como 0% haría parecer malo un canal
 * que simplemente no tiene costo cargado.
 */
export function computeRoi(incomeUsd: number | null, spendUsd: number | null): number | null {
  if (incomeUsd === null || spendUsd === null || spendUsd <= 0) return null
  return Math.round(((incomeUsd - spendUsd) / spendUsd) * 1000) / 10
}

/** Cuántos dólares volvieron por cada dólar puesto. `null` sin gasto. */
export function computeRoas(incomeUsd: number | null, spendUsd: number | null): number | null {
  if (incomeUsd === null || spendUsd === null || spendUsd <= 0) return null
  return Math.round((incomeUsd / spendUsd) * 100) / 100
}

/**
 * Honorarios sugeridos a partir del precio de venta y el porcentaje pactado.
 * El `honorarios_pct` vive en el bloque de condiciones de la tasación: es el
 * mejor default posible y hasta ahora no se usaba para nada más.
 */
export function suggestCommission(soldPrice: number | null, pct: number | null): number | null {
  if (soldPrice === null || pct === null) return null
  if (!Number.isFinite(soldPrice) || !Number.isFinite(pct)) return null
  if (soldPrice <= 0 || pct <= 0) return null
  return round2((soldPrice * pct) / 100)
}
