import type { MetaPageConnector, MetaPageWithToken } from '@vendepro/core'
import { META_GRAPH_API_VERSION } from '@vendepro/core'

/**
 * Habla con la Graph API para conectar la página de una inmobiliaria.
 *
 * Los errores de Meta se devuelven con su mensaje: "token vencido", "falta
 * pages_manage_metadata" o "sin acceso a la página" son cosas que el admin
 * puede resolver él mismo si las lee.
 */
export class MetaPageConnectorHttp implements MetaPageConnector {
  constructor(private readonly baseUrl = 'https://graph.facebook.com') {}

  async listPages(userAccessToken: string): Promise<MetaPageWithToken[]> {
    const url = this.url('/me/accounts')
    url.searchParams.set('fields', 'id,name,access_token')
    url.searchParams.set('limit', '100')
    url.searchParams.set('access_token', userAccessToken)

    const data = await this.request(url, 'GET')
    const pages = Array.isArray(data?.data) ? data.data : []
    return pages
      .filter((p: any) => p?.id && p?.access_token)
      .map((p: any) => ({ id: String(p.id), name: String(p.name ?? p.id), access_token: String(p.access_token) }))
  }

  async subscribeLeadgen(pageId: string, pageAccessToken: string): Promise<void> {
    const url = this.url(`/${encodeURIComponent(pageId)}/subscribed_apps`)
    url.searchParams.set('subscribed_fields', 'leadgen')
    url.searchParams.set('access_token', pageAccessToken)
    await this.request(url, 'POST')
  }

  private url(path: string): URL {
    return new URL(`${this.baseUrl.replace(/\/+$/, '')}/${META_GRAPH_API_VERSION}${path}`)
  }

  private async request(url: URL, method: 'GET' | 'POST'): Promise<any> {
    const res = await fetch(url.toString(), { method })
    const data = (await res.json().catch(() => null)) as any
    if (!res.ok) {
      const motivo = data?.error?.message
      throw new Error(`Meta respondió ${res.status}${motivo ? `: ${motivo}` : ''}`)
    }
    return data
  }
}
