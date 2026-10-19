import { describe, it, expect, vi, afterEach } from 'vitest'
import { MetaPageConnectorHttp } from '../../src/services/meta-page-connector-http'

afterEach(() => vi.unstubAllGlobals())

function respuesta(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('MetaPageConnectorHttp', () => {
  it('lista las páginas con su token desde /me/accounts', async () => {
    const fn = vi.fn().mockResolvedValue(respuesta(200, {
      data: [{ id: '1', name: 'Marcela Genta', access_token: 'pt' }, { id: '2', name: 'Sin token' }],
    }))
    vi.stubGlobal('fetch', fn)

    const pages = await new MetaPageConnectorHttp().listPages('ut')

    const url = new URL(fn.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/v24.0/me/accounts')
    expect(url.searchParams.get('access_token')).toBe('ut')
    expect(pages).toEqual([{ id: '1', name: 'Marcela Genta', access_token: 'pt' }])
  })

  it('suscribe la página al campo leadgen con POST', async () => {
    const fn = vi.fn().mockResolvedValue(respuesta(200, { success: true }))
    vi.stubGlobal('fetch', fn)

    await new MetaPageConnectorHttp().subscribeLeadgen('123', 'pt')

    const url = new URL(fn.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/v24.0/123/subscribed_apps')
    expect(url.searchParams.get('subscribed_fields')).toBe('leadgen')
    expect(fn.mock.calls[0]![1]).toEqual({ method: 'POST' })
  })

  it('devuelve el motivo que da Meta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(400, { error: { message: 'Error validating access token' } })))
    await expect(new MetaPageConnectorHttp().listPages('vencido')).rejects.toThrow('Error validating access token')
  })
})
