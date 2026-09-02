/**
 * Traduce el status HTTP de un proveedor de IA externo (Anthropic, Groq, Gemini…)
 * al status que devolvemos NOSOTROS.
 *
 * ## La regla: nunca emitir 401 ni 403
 *
 * `apiFetch` del frontend (`lib/api.ts`) trata **cualquier** 401 como "expiró tu
 * sesión": hace `clearToken()` y redirige a `/login`, borrando el token de
 * localStorage y la cookie —o sea, de todas las pestañas del dominio—.
 *
 * Esa premisa es correcta para un 401 de nuestra propia auth. El problema es que
 * un 401 del PROVEEDOR (credencial nuestra vencida, ausente o sin cuota) no tiene
 * nada que ver con la sesión del usuario, y al propagarlo tal cual lo
 * deslogueábamos y le hacíamos perder el trabajo sin guardar del editor de
 * tasación. Verificado en producción el 2026-09-02: la `ANTHROPIC_API_KEY` no
 * estaba cargada en el worker, Anthropic devolvía `401 invalid x-api-key`, y
 * apretar "extraer comparable" pateaba al agente a la pantalla de login.
 *
 * ## Qué se propaga y qué no
 *
 * Sólo los 4xx que hablan del **input del usuario**, porque son los únicos
 * accionables para quien está del otro lado ("probá con otra captura"). Todo lo
 * demás es un problema NUESTRO y sale como 502: el usuario no puede hacer nada
 * distinto, y mentirle con un 401 lo expulsa de la app.
 */

/** Status del proveedor que sí describen un problema del input del usuario. */
const PROPAGABLES = new Set([400, 413, 415, 422])

export interface ProviderErrorOptions {
  /** Nombre del proveedor, para el detalle del mensaje. Ej: 'anthropic'. */
  provider: string
  /** Mensaje accionable para el usuario cuando el fallo ES de su input. */
  inputMessage?: string
}

/**
 * Mapea el status del proveedor al nuestro.
 * - 400/413/415/422 → tal cual (problema del input)
 * - 429             → 429 (rate limit: accionable, y `apiFetch` no lo intercepta)
 * - **401/403**     → 502 (credencial/cuota NUESTRA — jamás 401 hacia el front)
 * - resto (5xx, 404, lo que sea) → 502
 */
export function mapProviderStatus(status: number): number {
  if (PROPAGABLES.has(status)) return status
  if (status === 429) return 429
  return 502
}

/**
 * Construye el Error con `statusCode` ya traducido y el cuerpo del proveedor
 * adjunto en el mensaje, para que quede en los logs y se pueda diagnosticar.
 */
export function providerError(
  status: number,
  body: string,
  opts: ProviderErrorOptions,
): Error & { statusCode: number } {
  const statusCode = mapProviderStatus(status)
  const msg =
    statusCode === 502
      ? 'El servicio de IA no está disponible en este momento. Probá de nuevo en unos minutos.'
      : statusCode === 429
        ? 'El servicio de IA está recibiendo demasiadas solicitudes. Probá de nuevo en un momento.'
        : (opts.inputMessage ?? 'No se pudo procesar el pedido. Revisá lo que enviaste.')

  const err = new Error(
    `${msg} [${opts.provider} ${status}: ${body.slice(0, 300)}]`,
  ) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}
