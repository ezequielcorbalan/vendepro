'use client'

// ============================================================
// Filtros que sobreviven a la navegación
//
// Problema: entrás a Leads, filtrás por "Nuevo", abrís un lead y volvés — la
// pantalla se remonta y el filtro vuelve al default. Con 185 leads eso
// significa volver a filtrar cada vez.
//
// Solución: guardar la selección en localStorage con vencimiento. No es la
// URL porque el "Volver a Leads" de la ficha es un Link a /leads (push, no
// history.back), así que los query params no vuelven solos. No es memoria del
// módulo porque un F5 la borraría, y el caso real incluye recargar.
//
// El vencimiento existe a propósito: recordar el filtro de la jornada es
// ayuda; recordarlo la semana que viene es una pantalla que miente sobre lo
// que está mostrando.
// ============================================================

/** Vence a las 8 horas: cubre un día de trabajo, no el siguiente. */
export const STICKY_FILTERS_TTL_MS = 8 * 60 * 60 * 1000

interface Envelope<T> {
  saved_at: number
  value: T
}

export function loadStickyFilters<T>(key: string, ttlMs: number = STICKY_FILTERS_TTL_MS): Partial<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const envelope = JSON.parse(raw) as Envelope<Partial<T>>
    if (!envelope?.saved_at || Date.now() - envelope.saved_at > ttlMs) {
      localStorage.removeItem(key)
      return null
    }
    return envelope.value ?? null
  } catch {
    return null
  }
}

export function saveStickyFilters<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ saved_at: Date.now(), value } satisfies Envelope<T>))
  } catch {
    // Sin localStorage (modo privado, cuota llena) el filtro simplemente no
    // se recuerda — no es motivo para romper la pantalla.
  }
}

export function clearStickyFilters(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* idem */ }
}
