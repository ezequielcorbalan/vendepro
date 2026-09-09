import type { FxRateService, FxRate } from '@vendepro/core'

/**
 * Cotización del dólar desde dolarapi.com.
 *
 * Se pidió "buscar la cotización de DolarHoy". DolarHoy **no expone una API
 * pública**: leer su HTML desde un Worker es frágil (cambia el markup, y el
 * sitio puede bloquear el request) y no se puede versionar. dolarapi.com sirve
 * la misma cotización en JSON, es gratis y sin key — así que es lo que se
 * consume, dejando "DolarHoy" como el nombre de referencia que ve el usuario.
 *
 * Se usa el **blue** a propósito: es el tipo de cambio al que se opera en el
 * mercado inmobiliario, no el oficial.
 *
 * Ante cualquier problema devuelve `null` y el gasto se guarda sin cotización,
 * para completarla a mano. Un tipo de cambio inventado contamina el ROI de
 * todo el período y nadie se entera.
 */
const DOLARAPI_BLUE = 'https://dolarapi.com/v1/dolares/blue'
const TIMEOUT_MS = 4000

export class DolarApiFxRate implements FxRateService {
  constructor(private readonly endpoint: string = DOLARAPI_BLUE) {}

  async usdRate(currency: string): Promise<FxRate | null> {
    const cur = currency?.trim().toUpperCase()
    if (cur === 'USD') return { rate: 1, source: 'identity', at: new Date().toISOString() }
    if (cur !== 'ARS') return null

    try {
      const res = await fetch(this.endpoint, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      })
      if (!res.ok) return null
      const body = (await res.json().catch(() => null)) as any

      // Se toma la venta: es el precio al que la inmobiliaria consigue dólares.
      const rate = Number(body?.venta)
      if (!Number.isFinite(rate) || rate <= 0) return null

      return { rate, source: 'dolarapi:blue', at: new Date().toISOString() }
    } catch {
      return null
    }
  }
}
