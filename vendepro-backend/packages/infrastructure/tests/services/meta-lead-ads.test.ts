import { describe, it, expect, vi, afterEach } from 'vitest'
import { MetaLeadAdsHttp } from '../../src/services/meta-lead-ads-http'
import { parsearLeadgenMeta, protegerIdsLargosMeta } from '../../src/services/meta-webhook'

afterEach(() => vi.unstubAllGlobals())

function respuesta(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('MetaLeadAdsHttp', () => {
  it('pide el lead con campaña y anuncio, con el token de página', async () => {
    const fn = vi.fn().mockResolvedValue(respuesta(200, {
      id: '1234567890123456', field_data: [{ name: 'email', values: ['a@b.com'] }],
      campaign_name: 'C1', ad_name: 'A1', platform: 'fb', form_id: 'f1',
    }))
    vi.stubGlobal('fetch', fn)

    const lead = await new MetaLeadAdsHttp().fetchLead('1234567890123456', 'tok')

    const url = new URL(fn.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/v24.0/1234567890123456')
    expect(url.searchParams.get('access_token')).toBe('tok')
    expect(url.searchParams.get('fields')).toContain('campaign_name')
    expect(lead.campaign_name).toBe('C1')
    expect(lead.field_data).toEqual([{ name: 'email', values: ['a@b.com'] }])
  })

  it('si el token no puede ver la campaña, reintenta sólo con el formulario', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce(respuesta(400, { error: { message: 'requires ads_read' } }))
      .mockResolvedValueOnce(respuesta(200, { id: '1', field_data: [] }))
    vi.stubGlobal('fetch', fn)

    const lead = await new MetaLeadAdsHttp().fetchLead('1', 'tok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(new URL(fn.mock.calls[1]![0] as string).searchParams.get('fields')).not.toContain('campaign_name')
    expect(lead.campaign_name).toBeNull()
  })

  it('tira el motivo de Meta si tampoco puede leer el formulario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(403, { error: { message: 'missing leads_retrieval' } })))
    await expect(new MetaLeadAdsHttp().fetchLead('1', 'tok')).rejects.toThrow('missing leads_retrieval')
  })
})

describe('webhook leadgen', () => {
  it('saca los leadgen de entry[].changes[] e ignora otros campos', () => {
    const payload = {
      object: 'page',
      entry: [{
        id: 'page1',
        changes: [
          { field: 'leadgen', value: { leadgen_id: '111', page_id: 'page1', form_id: 'f1' } },
          { field: 'feed', value: { item: 'post' } },
        ],
      }],
    }
    expect(parsearLeadgenMeta(payload)).toEqual([{ pageId: 'page1', leadgenId: '111', formId: 'f1' }])
  })

  it('ignora webhooks de Instagram y de mensajes', () => {
    const deInstagram = { object: 'instagram', entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id: '1', page_id: 'p' } }] }] }
    expect(parsearLeadgenMeta(deInstagram)).toEqual([])
    expect(parsearLeadgenMeta({ object: 'page', entry: [{ id: 'p', messaging: [{}] }] })).toEqual([])
  })

  it('no pierde precisión en IDs de 17 dígitos que Meta manda como número', () => {
    const raw = '{"object":"page","entry":[{"id":"p","changes":[{"field":"leadgen","value":{"leadgen_id":12345678901234567,"page_id":98765432109876543}}]}]}'
    // Sin proteger, JSON.parse redondea el ID.
    expect(String(JSON.parse(raw).entry[0].changes[0].value.leadgen_id)).not.toBe('12345678901234567')

    const [lead] = parsearLeadgenMeta(JSON.parse(protegerIdsLargosMeta(raw)))
    expect(lead!.leadgenId).toBe('12345678901234567')
    expect(lead!.pageId).toBe('98765432109876543')
  })
})
