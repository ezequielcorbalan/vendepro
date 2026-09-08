import { describe, it, expect, vi } from 'vitest'
import {
  ExtractComparableFromUrlUseCase,
  isAllowedListingHost,
} from '../../../src/application/use-cases/ai/extract-comparable-from-url'
import type {
  ListingPageFetcher,
  ListingPageFetchResult,
} from '../../../src/application/ports/services/listing-page-fetcher'
import type { ListingTextExtractor } from '../../../src/application/ports/services/ai-service'

const LONG_TEXT = 'Departamento 3 ambientes en Palermo. '.repeat(30)

function fetcherReturning(result: ListingPageFetchResult): ListingPageFetcher {
  return { fetchText: vi.fn().mockResolvedValue(result) }
}

const extractor = (): ListingTextExtractor & { extractComparableFromText: any } => ({
  extractComparableFromText: vi.fn().mockResolvedValue({
    address: 'Av. Santa Fe 3200',
    zonaprop_url: 'https://otra-cosa-que-leyo-el-modelo.com',
    price: 120000,
    total_area: 70,
    covered_area: null,
    usd_per_m2: null,
    days_on_market: null,
    views_per_day: null,
    age: null,
  }),
})

const statusCodeOf = async (p: Promise<unknown>): Promise<number | undefined> => {
  try {
    await p
    return undefined
  } catch (e: any) {
    return e.statusCode
  }
}

describe('isAllowedListingHost', () => {
  it('acepta los portales conocidos, con y sin www y con subdominios', () => {
    expect(isAllowedListingHost('www.zonaprop.com.ar')).toBe(true)
    expect(isAllowedListingHost('zonaprop.com.ar')).toBe(true)
    expect(isAllowedListingHost('departamento.mercadolibre.com.ar')).toBe(true)
    expect(isAllowedListingHost('www.argenprop.com')).toBe(true)
  })

  it('rechaza cualquier otro host — el endpoint no es un proxy abierto', () => {
    expect(isAllowedListingHost('evil.com')).toBe(false)
    expect(isAllowedListingHost('169.254.169.254')).toBe(false)
    // Sufijo parecido no alcanza: tiene que ser el dominio o un subdominio real.
    expect(isAllowedListingHost('fakezonaprop.com.ar')).toBe(false)
    expect(isAllowedListingHost('zonaprop.com.ar.evil.com')).toBe(false)
  })
})

describe('ExtractComparableFromUrlUseCase', () => {
  it('extrae del texto de la página y pisa zonaprop_url con el link REAL', async () => {
    const ex = extractor()
    const uc = new ExtractComparableFromUrlUseCase(
      fetcherReturning({ status: 'ok', text: LONG_TEXT, httpStatus: 200 }),
      ex,
    )
    const url = 'https://www.zonaprop.com.ar/propiedades/depto-123.html'
    const fields = await uc.execute({ url })
    expect(fields.address).toBe('Av. Santa Fe 3200')
    // El modelo a veces "lee" la URL de otro aviso de la misma página; la
    // nuestra la sabemos con certeza y gana siempre.
    expect(fields.zonaprop_url).toBe(url)
    expect(ex.extractComparableFromText).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: url }),
    )
  })

  it('400 ante URL vacía, inválida o de un host fuera de la lista', async () => {
    const uc = new ExtractComparableFromUrlUseCase(
      fetcherReturning({ status: 'ok', text: LONG_TEXT, httpStatus: 200 }),
      extractor(),
    )
    expect(await statusCodeOf(uc.execute({ url: '' }))).toBe(400)
    expect(await statusCodeOf(uc.execute({ url: 'no-es-una-url' }))).toBe(400)
    expect(await statusCodeOf(uc.execute({ url: 'https://evil.com/x' }))).toBe(400)
    expect(await statusCodeOf(uc.execute({ url: 'ftp://zonaprop.com.ar/x' }))).toBe(400)
  })

  it('422 con mensaje que empuja a la captura cuando el portal bloquea', async () => {
    const uc = new ExtractComparableFromUrlUseCase(
      fetcherReturning({ status: 'blocked', text: '', httpStatus: 403 }),
      extractor(),
    )
    try {
      await uc.execute({ url: 'https://www.zonaprop.com.ar/propiedades/x.html' })
      expect.unreachable()
    } catch (e: any) {
      expect(e.statusCode).toBe(422)
      expect(e.message).toContain('captura')
    }
  })

  it('404 si el aviso ya no existe, 502 si el portal no responde', async () => {
    const gone = new ExtractComparableFromUrlUseCase(
      fetcherReturning({ status: 'not_found', text: '', httpStatus: 404 }),
      extractor(),
    )
    expect(
      await statusCodeOf(gone.execute({ url: 'https://www.zonaprop.com.ar/x.html' })),
    ).toBe(404)

    const down = new ExtractComparableFromUrlUseCase(
      fetcherReturning({ status: 'unreachable', text: '', httpStatus: null }),
      extractor(),
    )
    expect(
      await statusCodeOf(down.execute({ url: 'https://www.zonaprop.com.ar/x.html' })),
    ).toBe(502)
  })

  it('422 si la página vino "ok" pero sin contenido legible (shell de JavaScript)', async () => {
    const uc = new ExtractComparableFromUrlUseCase(
      fetcherReturning({ status: 'ok', text: 'Cargando...', httpStatus: 200 }),
      extractor(),
    )
    expect(
      await statusCodeOf(uc.execute({ url: 'https://www.zonaprop.com.ar/x.html' })),
    ).toBe(422)
  })
})
