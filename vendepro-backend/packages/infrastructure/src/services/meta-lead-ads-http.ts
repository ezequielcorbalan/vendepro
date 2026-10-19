import type { MetaLeadAdsGateway, MetaLeadData } from '@vendepro/core'
import { META_GRAPH_API_VERSION } from '@vendepro/core'

const CAMPOS_BASE = 'id,created_time,field_data,form_id,platform'
/** Nombre de campaña y anuncio: el token de página puede no tener permiso para verlos. */
const CAMPOS_ATRIBUCION = 'campaign_name,ad_name'

/**
 * Lee un lead de Meta Lead Ads: `GET /{leadgen_id}` con el page access token
 * (permiso `leads_retrieval`).
 *
 * Primero pide también campaña y anuncio. Si Meta rechaza esos campos (al token
 * le falta `ads_read`), reintenta sólo con los datos del formulario: un lead
 * sin campaña sirve; un lead perdido, no.
 */
export class MetaLeadAdsHttp implements MetaLeadAdsGateway {
  constructor(private readonly baseUrl = 'https://graph.facebook.com') {}

  async fetchLead(leadgenId: string, pageAccessToken: string): Promise<MetaLeadData> {
    const conAtribucion = await this.get(leadgenId, pageAccessToken, `${CAMPOS_BASE},${CAMPOS_ATRIBUCION}`)
    const data = conAtribucion.ok
      ? conAtribucion.data
      : await this.get(leadgenId, pageAccessToken, CAMPOS_BASE).then(r => {
          if (!r.ok) throw new Error(`Meta respondió ${r.status}${r.motivo ? `: ${r.motivo}` : ''}`)
          return r.data
        })

    return {
      id: String(data?.id ?? leadgenId),
      created_time: data?.created_time ?? null,
      field_data: Array.isArray(data?.field_data)
        ? data.field_data.map((f: any) => ({
            name: String(f?.name ?? ''),
            values: Array.isArray(f?.values) ? f.values.map((v: unknown) => String(v)) : [],
          }))
        : [],
      form_id: data?.form_id ? String(data.form_id) : null,
      campaign_name: data?.campaign_name ?? null,
      ad_name: data?.ad_name ?? null,
      platform: data?.platform ?? null,
    }
  }

  private async get(id: string, token: string, fields: string): Promise<{ ok: boolean; status: number; data: any; motivo: string | null }> {
    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/${META_GRAPH_API_VERSION}/${encodeURIComponent(id)}`)
    url.searchParams.set('fields', fields)
    url.searchParams.set('access_token', token)
    const res = await fetch(url.toString())
    const data = (await res.json().catch(() => null)) as any
    return { ok: res.ok, status: res.status, data, motivo: data?.error?.message ?? null }
  }
}
