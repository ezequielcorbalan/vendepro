export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatCurrency(amount: number, currency: 'USD' | 'ARS' = 'USD'): string {
  if (currency === 'USD') {
    return `USD ${amount.toLocaleString('es-AR')}`
  }
  return `$ ${amount.toLocaleString('es-AR')}`
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Convierte a número un valor monetario que puede venir de un LLM, de un import
 * o de un formulario. Devuelve `null` cuando no hay un número inequívoco.
 *
 * Existe porque `parseFloat` es demasiado permisivo para esto: lee el prefijo y
 * descarta el resto. `parseFloat("hasta $650.000 por mes")` da **NaN**, y un
 * `NaN` bindeado a D1 corrompe la columna en silencio (el guard `input.x ? ... :
 * null` no lo atrapa: un string con texto es truthy). Pasaba con el presupuesto
 * que extrae la IA desde una imagen, que casi siempre vuelve como frase.
 *
 * Regla: sólo se acepta si, sacando símbolo de moneda y separadores de miles, lo
 * que queda es un número completo. Ante una frase se devuelve `null` — es
 * preferible un campo vacío que un importe inventado en una ficha comercial.
 */
export function parseMoneyOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const limpio = value
    .trim()
    .replace(/^(usd|u\$s|ar\$|\$|€)\s*/i, '')   // símbolo de moneda al principio
    .replace(/\s*(usd|ars|dolares|dólares|pesos)$/i, '') // moneda al final
    .trim()
  if (!limpio) return null

  // Separadores de miles con punto (1.250.000) y decimales con coma (1.250,50).
  const normalizado = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpio)
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio.replace(/,/g, '')

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}
