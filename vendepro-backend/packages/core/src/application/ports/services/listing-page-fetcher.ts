/**
 * Trae el texto de la página de un aviso publicado en un portal.
 *
 * Existe como puerto porque el `fetch` a un sitio externo es infraestructura, y
 * porque su modo de falla más probable —que el portal nos bloquee por bot— es
 * información que el caso de uso necesita para explicárselo al usuario en vez
 * de devolver un error genérico.
 */
export type ListingPageFetchStatus =
  /** Vino HTML y se pudo limpiar. */
  | 'ok'
  /** El portal respondió, pero con un muro anti-bot (403/429 o challenge). */
  | 'blocked'
  /** El aviso no existe o ya se dio de baja. */
  | 'not_found'
  /** Timeout, DNS, TLS: no hubo respuesta utilizable. */
  | 'unreachable'

export interface ListingPageFetchResult {
  status: ListingPageFetchStatus
  /** Texto plano de la página. Vacío salvo cuando `status === 'ok'`. */
  text: string
  /** Status HTTP crudo, para logs. `null` si no hubo respuesta. */
  httpStatus: number | null
}

export interface ListingPageFetcher {
  fetchText(url: string): Promise<ListingPageFetchResult>
}
