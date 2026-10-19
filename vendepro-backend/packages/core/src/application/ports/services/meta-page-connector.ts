/**
 * Conexión de la página de Facebook de una inmobiliaria con la app de Meta de
 * VendéPro: listar las páginas a las que llega un token y suscribir una a los
 * avisos de leads.
 */

export interface MetaPageWithToken {
  id: string
  name: string
  /** Page access token. Si el token de origen no vence, éste tampoco. */
  access_token: string
}

export interface MetaPageConnector {
  /** Páginas que administra el dueño del token (`GET /me/accounts`). */
  listPages(userAccessToken: string): Promise<MetaPageWithToken[]>
  /** Suscribe la página a la app para recibir el webhook `leadgen`. */
  subscribeLeadgen(pageId: string, pageAccessToken: string): Promise<void>
}
