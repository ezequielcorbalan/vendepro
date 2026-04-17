// ============================================================
// Semáforo de visualizaciones — Metodología de Marcela Genta
// Operaciones Inmobiliarias. Clasifica la performance de un
// aviso según visualizaciones/día en los portales.
// ============================================================

export type HealthStatus = 'red' | 'orange' | 'yellow' | 'light_green' | 'green'

export const REPORT_HEALTH_BENCHMARKS = {
  caba: { min_views_per_day: 14, min_in_person_visits_per_week: 1.5 },
  gba:  { min_views_per_day: 8,  min_in_person_visits_per_week: 1.0 },
  color_thresholds: {
    red:          { max_views_per_day: 9 },
    orange:       { max_views_per_day: 13 },
    yellow:       { max_views_per_day: 22 },
    light_green:  { max_views_per_day: 27 },
    green:        { min_views_per_day: 28 },
  },
  source: 'Marcela Genta Operaciones Inmobiliarias — Semáforo de visualizaciones',
} as const

export function computeHealthStatus(viewsPerDay: number): HealthStatus {
  if (!Number.isFinite(viewsPerDay) || viewsPerDay <= 9) return 'red'
  if (viewsPerDay <= 13) return 'orange'
  if (viewsPerDay <= 22) return 'yellow'
  if (viewsPerDay <= 27) return 'light_green'
  return 'green'
}

/** Días completos entre dos fechas ISO (YYYY-MM-DD). Mínimo 1 para evitar div/0. */
export function daysBetweenISO(startISO: string, endISO: string): number {
  const start = new Date(startISO + 'T00:00:00Z').getTime()
  const end = new Date(endISO + 'T00:00:00Z').getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1
  const diffMs = end - start
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, days)
}
