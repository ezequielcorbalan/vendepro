import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpListingPageFetcher, htmlToText } from '../../src/services/http-listing-page-fetcher'

const res = (status: number, body = '') => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
})

beforeEach(() => vi.restoreAllMocks())

describe('htmlToText', () => {
  it('deja el texto visible y tira scripts, estilos y tags', () => {
    const t = htmlToText(`<html><head><style>.a{color:red}</style></head>
      <body><script>var x=1</script><h1>Depto 3 amb</h1><p>USD 120.000</p></body></html>`)
    expect(t).toContain('Depto 3 amb')
    expect(t).toContain('USD 120.000')
    expect(t).not.toContain('var x=1')
    expect(t).not.toContain('color:red')
  })

  it('conserva el JSON-LD: ahí viven precio y superficie cuando el HTML es un shell', () => {
    const t = htmlToText(`<body><div id="app"></div>
      <script type="application/ld+json">{"@type":"Product","offers":{"price":120000}}</script></body>`)
    expect(t).toContain('"price":120000')
  })

  it('decodifica entidades comunes del español', () => {
    expect(htmlToText('<p>3 dormitorios, 85 m&sup2; en Almagro y balc&oacute;n</p>')).toContain('balcón')
    expect(htmlToText('<p>a&ntilde;os</p>')).toContain('años')
  })
})

describe('HttpListingPageFetcher', () => {
  const url = 'https://www.zonaprop.com.ar/propiedades/x.html'

  it('ok con el texto de la página', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(res(200, '<h1>Depto en venta</h1>') as any)
    const r = await new HttpListingPageFetcher().fetchText(url)
    expect(r.status).toBe('ok')
    expect(r.text).toContain('Depto en venta')
  })

  it('403 y 429 son "blocked": la UI tiene que ofrecer la captura, no un error genérico', async () => {
    for (const status of [403, 429]) {
      vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(res(status) as any)
      const r = await new HttpListingPageFetcher().fetchText(url)
      expect(r.status).toBe('blocked')
      expect(r.httpStatus).toBe(status)
    }
  })

  it('detecta el challenge anti-bot aunque venga con 200 (DataDome responde así)', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      res(200, '<html><head><title>Just a moment</title><script src="https://ct.captcha-delivery.com/c.js"></script></head></html>') as any,
    )
    const r = await new HttpListingPageFetcher().fetchText(url)
    expect(r.status).toBe('blocked')
  })

  it('404/410 es "not_found", excepción de red es "unreachable"', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(res(404) as any)
    expect((await new HttpListingPageFetcher().fetchText(url)).status).toBe('not_found')

    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'))
    const r = await new HttpListingPageFetcher().fetchText(url)
    expect(r.status).toBe('unreachable')
    expect(r.httpStatus).toBeNull()
  })

  it('se presenta como navegador: sin UA real varios portales devuelven 403 de entrada', async () => {
    const f = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(res(200, '<p>x</p>') as any)
    await new HttpListingPageFetcher().fetchText(url)
    const headers = (f.mock.calls[0]![1] as any).headers
    expect(headers['User-Agent']).toContain('Mozilla/5.0')
    expect(headers['Accept-Language']).toContain('es-AR')
  })
})
