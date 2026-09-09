/**
 * Períodos del panel de Marketing.
 *
 * Los tres son **de calendario y hasta hoy** (mes en curso, trimestre en curso,
 * año en curso). Antes cada uno se calculaba distinto — mes desde el día 1,
 * trimestre como ventana móvil de 3 meses, año desde el 1 de enero — así que
 * "Mes" y "Trimestre" no eran comparables entre sí.
 *
 * El período anterior NO es el mes/trimestre/año completo: es la **misma
 * cantidad de días transcurridos** contada desde el arranque del período
 * anterior. Comparar los 3 días que van de septiembre contra los 30 de agosto
 * daría siempre una caída.
 *
 * Los límites son fechas `YYYY-MM-DD` a propósito: `leads.created_at` convive
 * en dos formatos ("YYYY-MM-DD HH:MM:SS" de `datetime('now')` y el ISO con "T"
 * de `toISOString()`), y sólo la comparación a nivel día ordena bien en los dos.
 * Rango semiabierto: `created_at >= from AND created_at < to`.
 */

export type MarketingPeriod = 'month' | 'quarter' | 'year'

export const MARKETING_PERIODS: readonly MarketingPeriod[] = ['month', 'quarter', 'year'] as const

export interface DateRange {
  /** YYYY-MM-DD inclusive */
  from: string
  /** YYYY-MM-DD exclusive */
  to: string
}

export interface MarketingPeriodRanges {
  period: MarketingPeriod
  current: DateRange
  previous: DateRange
  /** Días transcurridos del período en curso, hoy incluido. */
  elapsedDays: number
}

export function parseMarketingPeriod(raw: string | null | undefined): MarketingPeriod {
  return MARKETING_PERIODS.includes(raw as MarketingPeriod) ? (raw as MarketingPeriod) : 'month'
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

/** Arranque del período de calendario que contiene a `day`. */
function periodStart(period: MarketingPeriod, day: Date): Date {
  const y = day.getUTCFullYear()
  const m = day.getUTCMonth()
  switch (period) {
    case 'month':   return new Date(Date.UTC(y, m, 1))
    case 'quarter': return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1))
    case 'year':    return new Date(Date.UTC(y, 0, 1))
  }
}

/** Arranque del período de calendario inmediatamente anterior a `start`. */
function previousPeriodStart(period: MarketingPeriod, start: Date): Date {
  const y = start.getUTCFullYear()
  const m = start.getUTCMonth()
  switch (period) {
    case 'month':   return new Date(Date.UTC(y, m - 1, 1))
    case 'quarter': return new Date(Date.UTC(y, m - 3, 1))
    case 'year':    return new Date(Date.UTC(y - 1, 0, 1))
  }
}

export function marketingPeriodRanges(
  period: MarketingPeriod,
  now: Date = new Date(),
): MarketingPeriodRanges {
  const today = utcDay(now)
  const start = periodStart(period, today)
  const tomorrow = addDays(today, 1)

  const elapsedDays = Math.round((tomorrow.getTime() - start.getTime()) / 86_400_000)

  const prevStart = previousPeriodStart(period, start)
  const prevEnd = addDays(prevStart, elapsedDays)

  return {
    period,
    current:  { from: ymd(start),     to: ymd(tomorrow) },
    previous: { from: ymd(prevStart), to: ymd(prevEnd) },
    elapsedDays,
  }
}

/**
 * Variación porcentual entre dos períodos. `null` cuando no hay base contra
 * qué comparar (el período anterior fue cero): mostrar "—" y no un +100%
 * que no significa nada.
 */
export function periodDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/**
 * Ventana que baja el cron diario de pauta.
 *
 * No alcanza con pedir "ayer": **Meta reatribuye hacia atrás**. Una conversión
 * de hace tres días puede aparecer recién hoy, y el gasto del último día suele
 * ajustarse. Por eso se re-pide toda la ventana y el sync hace upsert: los días
 * ya guardados se corrigen en lugar de duplicarse.
 *
 * Incluye el día de hoy (parcial) a propósito: el panel muestra "mes a hoy" y
 * mañana esa fila se reescribe completa.
 *
 * Los dos extremos son inclusivos, como el `time_range` de la API de Meta.
 */
export function adSyncWindow(now: Date = new Date(), lookbackDays = 7): { since: string; until: string } {
  const today = utcDay(now)
  const since = new Date(today)
  since.setUTCDate(since.getUTCDate() - lookbackDays)
  return { since: ymd(since), until: ymd(today) }
}
