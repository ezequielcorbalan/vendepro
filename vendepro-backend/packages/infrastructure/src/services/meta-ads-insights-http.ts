import type {
  MetaAdsInsightsService,
  GetCampaignInsightsHttpInput,
  GetCampaignInsightsHttpResult,
  CampaignInsight,
  GetAdInsightsInput,
  GetAdInsightsResult,
  AdDailyInsight,
  GetAdsResult,
  AdCreativeInfo,
} from '@vendepro/core'

/**
 * HTTP adapter para Meta Marketing API (Ads Insights).
 *
 * Endpoint:
 *   GET https://graph.facebook.com/v17.0/act_{id}/insights
 *       ?level=campaign&fields=...&time_range={"since","until"}
 *
 * Requiere token con permiso `ads_read` sobre el ad account.
 */

// action_types que Meta usa para reportar leads según el origen
// (formulario nativo, pixel en la web, o el agregado 'lead').
const LEAD_ACTION_TYPES = new Set([
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
])

export class MetaAdsInsightsHttp implements MetaAdsInsightsService {
  async getCampaignInsights(input: GetCampaignInsightsHttpInput): Promise<GetCampaignInsightsHttpResult> {
    if (!input.adAccountId) return { ok: false, status: 0, campaigns: [], error: 'adAccountId is required' }
    if (!input.accessToken) return { ok: false, status: 0, campaigns: [], error: 'accessToken is required' }

    const account = input.adAccountId.startsWith('act_') ? input.adAccountId : `act_${input.adAccountId}`
    const url = new URL(`https://graph.facebook.com/v17.0/${account}/insights`)
    url.searchParams.set('level', 'campaign')
    url.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,actions,account_currency')
    url.searchParams.set('time_range', JSON.stringify({ since: input.since, until: input.until }))
    url.searchParams.set('limit', '100')
    url.searchParams.set('access_token', input.accessToken)

    try {
      const res = await fetch(url.toString())
      const body = (await res.json().catch(() => ({}))) as any
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          campaigns: [],
          error: body?.error?.message ?? `HTTP ${res.status}`,
        }
      }

      const campaigns: CampaignInsight[] = ((body?.data ?? []) as any[]).map(row => {
        const leads = ((row.actions ?? []) as any[])
          // 'lead' agrega las variantes onsite/offsite — si viene, es el total;
          // si no, sumamos las variantes específicas.
          .filter(a => LEAD_ACTION_TYPES.has(a.action_type))
          .reduce((max, a) => Math.max(max, Number(a.value) || 0), 0)
        return {
          campaign_id: String(row.campaign_id ?? ''),
          campaign_name: String(row.campaign_name ?? ''),
          spend: Number(row.spend) || 0,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
          leads,
          account_currency: row.account_currency ?? null,
        }
      })

      return { ok: true, status: res.status, campaigns }
    } catch (err: any) {
      return { ok: false, status: 0, campaigns: [], error: err?.message ?? 'network error' }
    }
  }

  /**
   * Insights día por día a nivel anuncio.
   *
   * `time_increment=1` es lo que parte el resultado en una fila por día en vez
   * de un agregado del rango: sin eso no hay serie temporal posible.
   *
   * Pagina siguiendo `paging.next`: una cuenta con muchos anuncios por muchos
   * días supera holgadamente el límite de una página, y quedarse con la primera
   * dejaría un histórico incompleto sin que nadie se entere.
   */
  async getAdInsights(input: GetAdInsightsInput): Promise<GetAdInsightsResult> {
    if (!input.adAccountId) return { ok: false, status: 0, insights: [], error: 'adAccountId is required' }
    if (!input.accessToken) return { ok: false, status: 0, insights: [], error: 'accessToken is required' }

    const account = input.adAccountId.startsWith('act_') ? input.adAccountId : `act_${input.adAccountId}`
    const url = new URL(`https://graph.facebook.com/v17.0/${account}/insights`)
    url.searchParams.set('level', 'ad')
    url.searchParams.set('time_increment', '1')
    url.searchParams.set('fields', [
      'date_start', 'ad_id', 'ad_name', 'adset_id', 'adset_name',
      'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks',
      'reach', 'frequency', 'actions', 'account_currency',
    ].join(','))
    url.searchParams.set('time_range', JSON.stringify({ since: input.since, until: input.until }))
    url.searchParams.set('limit', '500')
    url.searchParams.set('access_token', input.accessToken)

    const insights: AdDailyInsight[] = []
    let next: string | null = url.toString()
    let status = 0
    // Tope de seguridad: 20 páginas × 500 filas cubre cuentas grandes y evita
    // un bucle infinito si la API devolviera siempre el mismo cursor.
    let pages = 0

    try {
      while (next && pages < 20) {
        const res: Response = await fetch(next)
        status = res.status
        const body = (await res.json().catch(() => ({}))) as any
        if (!res.ok) {
          return { ok: false, status: res.status, insights: [], error: body?.error?.message ?? `HTTP ${res.status}` }
        }

        for (const row of (body?.data ?? []) as any[]) {
          const leads = ((row.actions ?? []) as any[])
            .filter(a => LEAD_ACTION_TYPES.has(a.action_type))
            .reduce((max, a) => Math.max(max, Number(a.value) || 0), 0)

          insights.push({
            date: String(row.date_start ?? ''),
            ad_id: String(row.ad_id ?? ''),
            ad_name: row.ad_name ?? null,
            ad_set_id: row.adset_id ? String(row.adset_id) : null,
            ad_set_name: row.adset_name ?? null,
            campaign_id: String(row.campaign_id ?? ''),
            campaign_name: row.campaign_name ?? null,
            spend: Number(row.spend) || 0,
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            leads,
            reach: row.reach != null ? Number(row.reach) || 0 : null,
            frequency: row.frequency != null ? Number(row.frequency) || 0 : null,
            account_currency: row.account_currency ?? null,
          })
        }

        next = body?.paging?.next ?? null
        pages++
      }

      return { ok: true, status, insights }
    } catch (err: any) {
      return { ok: false, status: 0, insights: [], error: err?.message ?? 'network error' }
    }
  }

  /**
   * Fichas de los anuncios con su creativo: lo que no cambia por día. Se pide
   * aparte de los insights porque el endpoint de insights no devuelve la
   * miniatura ni el copy, que es justo lo que hace falta para el ranking de
   * creativos.
   */
  async getAds(input: { adAccountId: string; accessToken: string }): Promise<GetAdsResult> {
    if (!input.adAccountId) return { ok: false, status: 0, ads: [], error: 'adAccountId is required' }
    if (!input.accessToken) return { ok: false, status: 0, ads: [], error: 'accessToken is required' }

    const account = input.adAccountId.startsWith('act_') ? input.adAccountId : `act_${input.adAccountId}`
    const url = new URL(`https://graph.facebook.com/v17.0/${account}/ads`)
    url.searchParams.set('fields', [
      'id', 'name', 'status', 'campaign_id', 'adset_id',
      'creative{thumbnail_url,title,body,effective_object_story_id,object_story_spec}',
    ].join(','))
    url.searchParams.set('limit', '500')
    url.searchParams.set('access_token', input.accessToken)

    const ads: AdCreativeInfo[] = []
    let next: string | null = url.toString()
    let status = 0
    let pages = 0

    try {
      while (next && pages < 20) {
        const res: Response = await fetch(next)
        status = res.status
        const body = (await res.json().catch(() => ({}))) as any
        if (!res.ok) {
          return { ok: false, status: res.status, ads: [], error: body?.error?.message ?? `HTTP ${res.status}` }
        }

        for (const row of (body?.data ?? []) as any[]) {
          const creative = row.creative ?? {}
          const storyId = creative.effective_object_story_id
          ads.push({
            ad_id: String(row.id ?? ''),
            name: row.name ?? null,
            status: row.status ?? null,
            campaign_id: row.campaign_id ? String(row.campaign_id) : null,
            ad_set_id: row.adset_id ? String(row.adset_id) : null,
            thumbnail_url: creative.thumbnail_url ?? null,
            title: creative.title ?? null,
            body: creative.body ?? null,
            // El permalink al post real sólo existe si el creativo está atado a
            // una publicación de la página.
            permalink: storyId ? `https://www.facebook.com/${storyId}` : null,
            destination_url: extractDestinationUrl(creative),
          })
        }

        next = body?.paging?.next ?? null
        pages++
      }

      return { ok: true, status, ads }
    } catch (err: any) {
      return { ok: false, status: 0, ads: [], error: err?.message ?? 'network error' }
    }
  }
}

/**
 * URL de destino del anuncio. Meta la esconde en distintos lugares del
 * `object_story_spec` según el formato del creativo (link, video, carrusel),
 * así que se prueban los conocidos y se cae a null.
 *
 * Es el dato que en F3 permite proponer solo el objetivo comercial: si el
 * anuncio manda a la landing de tasación es captación; si manda a una landing
 * de propiedad, demanda.
 */
function extractDestinationUrl(creative: any): string | null {
  const spec = creative?.object_story_spec
  if (!spec) return null
  return (
    spec.link_data?.link ??
    spec.video_data?.call_to_action?.value?.link ??
    spec.link_data?.child_attachments?.[0]?.link ??
    null
  )
}
