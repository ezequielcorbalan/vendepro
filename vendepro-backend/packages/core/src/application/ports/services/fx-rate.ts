/**
 * Cotización del dólar para convertir el gasto de portales (que se factura en
 * pesos) a la moneda en la que la inmobiliaria piensa el negocio.
 *
 * El valor que devuelve son **unidades de la moneda por 1 USD** (ej. 1450 para
 * ARS), que es como se lee una cotización acá y no obliga a guardar decimales
 * minúsculos en la base.
 *
 * Devolver `null` es una respuesta válida y esperada: si la fuente no responde,
 * la fila se guarda sin cotización y se completa a mano. Nunca se inventa un
 * número — un tipo de cambio inventado contamina el ROI de todo el período.
 */
export interface FxRate {
  /** Unidades de `currency` por 1 USD. */
  rate: number
  /** De dónde salió, para poder auditarlo después (ej. 'dolarapi:blue'). */
  source: string
  /** ISO del momento en que se resolvió. */
  at: string
}

export interface FxRateService {
  /** `null` si la fuente no responde o la moneda no está soportada. */
  usdRate(currency: string): Promise<FxRate | null>
}
