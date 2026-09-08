import type {
  ComparablePropertyData,
  ListingTextExtractor,
} from '../../ports/services/ai-service'
import type { ListingPageFetcher } from '../../ports/services/listing-page-fetcher'

export interface ExtractComparableFromUrlInput {
  url: string
}

/**
 * Portales cuyas URLs aceptamos.
 *
 * La lista blanca no es decoración: sin ella este endpoint es un proxy HTTP
 * abierto y autenticado —cualquier usuario logueado podría hacer que NUESTRO
 * worker pegue a cualquier host, incluidos los metadata endpoints de la nube—.
 * Agregar un portal es agregar una línea acá.
 */
const ALLOWED_HOSTS = [
  'zonaprop.com.ar',
  'argenprop.com',
  'mercadolibre.com.ar',
  'properati.com.ar',
  'remax.com.ar',
  'inmoclick.com.ar',
  'buscainmueble.com',
] as const

/** Debajo de esto la página no trajo aviso: es un challenge o un shell vacío. */
const MIN_USABLE_TEXT = 400

function fail(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}

export function isAllowedListingHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '')
  return ALLOWED_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`))
}

export function listingHostsLabel(): string {
  return ALLOWED_HOSTS.join(', ')
}

/**
 * Arma los datos de una propiedad de la competencia a partir del link del aviso.
 *
 * Es el camino "pegá el link" del wizard de reportes. El camino "pegá la
 * captura" sigue siendo `ExtractComparableFromScreenshotUseCase`: cuando el
 * portal nos bloquea —que pasa y va a seguir pasando— este caso de uso lo dice
 * explícitamente para que la UI empuje a la captura, en vez de devolver un
 * error genérico que el usuario lee como "la IA no pudo".
 */
export class ExtractComparableFromUrlUseCase {
  constructor(
    private readonly fetcher: ListingPageFetcher,
    private readonly extractor: ListingTextExtractor,
  ) {}

  async execute(input: ExtractComparableFromUrlInput): Promise<ComparablePropertyData> {
    const raw = (input.url ?? '').trim()
    if (!raw) throw fail('Pegá el link del aviso.', 400)

    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      throw fail('Ese link no es una URL válida.', 400)
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw fail('El link tiene que ser http o https.', 400)
    }
    if (!isAllowedListingHost(parsed.hostname)) {
      throw fail(
        `Por ahora sólo leemos links de: ${listingHostsLabel()}. Para otro portal, subí una captura del aviso.`,
        400,
      )
    }

    const page = await this.fetcher.fetchText(parsed.toString())

    if (page.status === 'not_found') {
      throw fail('El aviso ya no está publicado o el link está mal.', 404)
    }
    if (page.status === 'blocked') {
      throw fail(
        `${parsed.hostname} bloqueó la lectura automática del aviso. Subí una captura de pantalla y la leemos igual.`,
        422,
      )
    }
    if (page.status === 'unreachable') {
      throw fail(`No se pudo abrir ${parsed.hostname}. Probá de nuevo o subí una captura.`, 502)
    }
    if (page.text.trim().length < MIN_USABLE_TEXT) {
      throw fail(
        `${parsed.hostname} devolvió una página sin contenido legible (carga el aviso por JavaScript). Subí una captura y la leemos igual.`,
        422,
      )
    }

    const fields = await this.extractor.extractComparableFromText({
      text: page.text,
      sourceUrl: parsed.toString(),
    })

    // El link lo tenemos con certeza; que el modelo lo "lea" de la página es
    // innecesario y a veces devuelve la URL de otro aviso de la misma pantalla.
    return { ...fields, zonaprop_url: parsed.toString() }
  }
}
