/**
 * Vencimiento de la autorización de venta (mandato).
 *
 * Vence el `auth_start_date + auth_duration_days`. La duración por defecto es
 * 180 días, igual que la columna (migración 013) y que la query del barrido
 * cron: si las tres no coinciden, el aviso sale en una fecha y la ficha
 * muestra otra.
 */
export const DEFAULT_AUTH_DURATION_DAYS = 180

const DAY_MS = 86_400_000

/** 'YYYY-MM-DD' del vencimiento, o null si no hay fecha de inicio válida. */
export function authorizationExpiry(
  startDate: string | null | undefined,
  durationDays: number | null | undefined,
): string | null {
  const start = parseYmd(startDate)
  if (start === null) return null
  const days = durationDays ?? DEFAULT_AUTH_DURATION_DAYS
  return new Date(start + days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * Días corridos desde `today` hasta el vencimiento (negativo si ya venció).
 * Se cuenta por fecha calendario, no por horas: "vence mañana" es 1 a
 * cualquier hora del día.
 */
export function daysUntil(expiry: string | null, today: string): number | null {
  const end = parseYmd(expiry)
  const now = parseYmd(today)
  if (end === null || now === null) return null
  return Math.round((end - now) / DAY_MS)
}

/** Acepta 'YYYY-MM-DD' o un ISO completo; se queda con la fecha. */
function parseYmd(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(t) ? null : t
}
