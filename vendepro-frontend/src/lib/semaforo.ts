// ============================================================
// Semáforo de visualizaciones — helpers de cliente
// ============================================================
// Clasificación cualitativa de performance de un aviso según
// visualizaciones por día. Espejo del helper del backend.
// Metodología: Marcela Genta Operaciones Inmobiliarias.

export type HealthStatus = 'red' | 'orange' | 'yellow' | 'light_green' | 'green'

export interface HealthColor {
  bg: string
  text: string
  border: string
  dot: string
  label: string
}

export const HEALTH_COLORS: Record<HealthStatus, HealthColor> = {
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-300',
    dot: 'bg-red-500',
    label: 'Crítico',
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
    label: 'Bajo',
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-300',
    dot: 'bg-yellow-400',
    label: 'Aceptable',
  },
  light_green: {
    bg: 'bg-lime-50',
    text: 'text-lime-700',
    border: 'border-lime-300',
    dot: 'bg-lime-500',
    label: 'Bien',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-300',
    dot: 'bg-green-500',
    label: 'Excelente',
  },
}

/** Determina el estado del semáforo a partir de visualizaciones por día.
 *  Espejo de `computeHealthStatus` del backend. */
export function healthStatusFromViewsPerDay(viewsPerDay: number): HealthStatus {
  if (!Number.isFinite(viewsPerDay) || viewsPerDay <= 9) return 'red'
  if (viewsPerDay <= 13) return 'orange'
  if (viewsPerDay <= 22) return 'yellow'
  if (viewsPerDay <= 27) return 'light_green'
  return 'green'
}
