import type { AIService, LeadIntent, ComparablePropertyData } from '@vendepro/core'
import { providerError } from './provider-error'

/**
 * Adapter de IA sobre Gemini, por su endpoint **compatible con OpenAI**.
 *
 * Un solo modelo cubre las 6 features (texto, visión y generación de JSON), lo
 * que evita el arreglo anterior de dos proveedores y dos modelos. Elegido con
 * benchmark contra los prompts reales sobre un aviso con trampas
 * (`doc/ia-auditoria-2026-09-02.md` § Benchmark): 8/8, ~2,4 s y USD 0,79 por
 * cada 1000 llamadas — mismo puntaje que los modelos grandes, 3-4× más rápido
 * y 4× más barato.
 *
 * Usar el dialecto OpenAI y no el nativo de Google es deliberado: cambiar de
 * proveedor vuelve a ser cambiar `BASE_URL` y `MODEL`, no reescribir el adapter.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

/** Modelo único para todo. Ver el benchmark antes de cambiarlo. */
const MODEL = 'gemini-3.5-flash-lite'

/** Formatos que aceptamos como entrada de imagen. */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function normalizeImageMediaType(mimeType?: string): string {
  const t = (mimeType ?? 'image/png').toLowerCase().trim()
  return t === 'image/jpg' ? 'image/jpeg' : t
}

function badInput(message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = 400
  return err
}

/** Tolera fences de markdown y texto alrededor del JSON (objeto o array). */
export function parseJsonLoose(raw: string): any | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const objStart = cleaned.indexOf('{')
    const arrStart = cleaned.indexOf('[')
    const isArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart)
    const start = isArray ? arrStart : objStart
    const end = isArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

const num = (v: unknown): number | null =>
  Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null

type Part =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export class GeminiAIService implements AIService {
  constructor(private readonly apiKey: string) {
    // Guard explícito. Sin esto, una key ausente queda `undefined`, se serializa
    // como el string "undefined" en el header, el request SALE igual y el
    // proveedor lo rechaza con 401 — que después se disfraza de tres formas
    // distintas según qué ruta lo agarre (500 mudo, 401 que desloguea al
    // usuario, o 200 con el error adentro del body). Fallar acá, con un status
    // propio y distinguible, mata las cuatro variantes de una.
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      const err = new Error(
        'Falta GEMINI_API_KEY en el worker. Las features de IA no pueden funcionar hasta que se configure.',
      ) as Error & { statusCode: number }
      err.statusCode = 503
      throw err
    }
  }

  // ── transporte ────────────────────────────────────────────────

  private async chat(
    messages: Array<{ role: 'system' | 'user'; content: string | Part[] }>,
    opts: { maxTokens: number; timeoutMs: number; temperature?: number },
  ): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs)
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_tokens: opts.maxTokens,
          temperature: opts.temperature ?? 0.1,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error(`[GeminiAIService] ${res.status} ${body.slice(0, 500)}`)
        throw providerError(res.status, body, {
          provider: 'gemini',
          inputMessage: 'No se pudo procesar el pedido. Probá con otra captura (JPG, PNG o WEBP).',
        })
      }
      const data = (await res.json()) as any
      return data.choices?.[0]?.message?.content ?? ''
    } finally {
      clearTimeout(timeout)
    }
  }

  private async vision(
    imageBase64: string,
    mimeType: string | undefined,
    prompt: string,
    opts: { maxTokens: number; timeoutMs: number },
  ): Promise<string> {
    if (!imageBase64?.trim()) throw badInput('No llegó ninguna imagen.')
    const mediaType = normalizeImageMediaType(mimeType)
    if (!IMAGE_TYPES.has(mediaType)) {
      throw badInput(`Formato de imagen no soportado (${mediaType}). Usá JPG, PNG, GIF o WEBP.`)
    }
    return this.chat(
      [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
          { type: 'text', text: prompt },
        ],
      }],
      opts,
    )
  }

  // ── leads ─────────────────────────────────────────────────────

  async extractLeadIntent(text: string): Promise<LeadIntent> {
    const system = `Sos un asistente de CRM inmobiliario argentino. Extraé los datos del lead del texto.
Devolvé SOLO un JSON válido con los campos que puedas identificar:
{ full_name, phone, email, neighborhood, property_type, operation, notes, budget }
Si no encontrás un campo, NO lo incluyas. Solo datos concretos: no inventes nada.`
    const raw = await this.chat(
      [{ role: 'system', content: system }, { role: 'user', content: text }],
      { maxTokens: 500, timeoutMs: 15_000 },
    )
    return (parseJsonLoose(raw) as LeadIntent) ?? {}
  }

  async extractLeadFromImage(imageBase64: string, mimeType = 'image/jpeg'): Promise<LeadIntent> {
    const raw = await this.vision(
      imageBase64,
      mimeType,
      `Sos asistente de CRM inmobiliario argentino. Extraé datos del cliente/lead de esta imagen.
Puede ser: conversación de WhatsApp, mail, tarjeta de presentación, nota manuscrita o consulta de portal.
Devolvé SOLO un JSON válido con los campos que puedas identificar:
{ "full_name": "", "phone": "", "email": "", "neighborhood": "", "property_type": "", "operation": "", "notes": "", "budget": "" }
Solo incluí campos con datos concretos que veas claramente. No inventes nada.`,
      { maxTokens: 500, timeoutMs: 20_000 },
    )
    return (parseJsonLoose(raw) as LeadIntent) ?? {}
  }

  async transcribeAudio(_audioBuffer: ArrayBuffer, _mimeType: string): Promise<string> {
    // Sin implementar a propósito: no hay ningún caller en el repo (ver
    // `doc/ia-auditoria-2026-09-02.md` § O.1, código muerto). Si algún día se
    // expone, Gemini acepta audio como una parte más del mensaje.
    throw new Error('transcribeAudio no está implementado')
  }

  // ── extracción desde captura ──────────────────────────────────

  async extractMetricsFromScreenshot(
    imageBase64: string,
    mimeType?: string,
  ): Promise<Record<string, unknown>> {
    const raw = await this.vision(
      imageBase64,
      mimeType,
      `Extraé las métricas de esta captura de estadísticas de un portal inmobiliario.
Devolvé SOLO un JSON con estos campos, usando null en los que no aparezcan:
{
  "impressions": impresiones (número),
  "portal_visits": visitas al aviso (número),
  "inquiries": consultas (número),
  "phone_calls": llamadas (número),
  "whatsapp": contactos por WhatsApp (número),
  "ranking_position": posición en el ranking (número)
}
Sin explicaciones y sin markdown.`,
      { maxTokens: 500, timeoutMs: 20_000 },
    )
    return (parseJsonLoose(raw) as Record<string, unknown>) ?? {}
  }

  async extractComparableFromScreenshot(
    imageBase64: string,
    mimeType?: string,
  ): Promise<ComparablePropertyData> {
    const raw = await this.vision(
      imageBase64,
      mimeType,
      `Esta es una captura de una publicación inmobiliaria (Zonaprop, Argenprop o similar).
Extraé los datos de la propiedad en JSON con esta forma exacta:

{
  "address": "calle y número o intersección, o null",
  "zonaprop_url": "URL si aparece visible, o null",
  "total_area": número en m² (superficie total) o null,
  "covered_area": número en m² (superficie cubierta) o null,
  "price": número en USD (sin signo, sin separadores) o null,
  "usd_per_m2": número (precio por m² en USD) o null,
  "days_on_market": número de días publicado, o null,
  "views_per_day": número de visualizaciones promedio diarias, o null,
  "construction_year": año de construcción tal como figura (número de 4 dígitos), o null
}

Reglas:
- Si el valor no aparece o es ambiguo, usá null. NUNCA tomes datos de secciones
  tipo "propiedades similares" o "también te puede interesar": son OTRAS propiedades.
- price siempre en USD. Si está en pesos, convertilo sólo si hay tipo de cambio
  visible en la misma captura; si no, null.
- views_per_day es el promedio DIARIO. Si sólo ves un total acumulado y los días
  publicado, dividí; si no podés, null.
- NO calcules la antigüedad: devolvé el año de construcción tal cual. La
  antigüedad la calcula el sistema.
- Devolvé SOLO el JSON, sin explicaciones, sin markdown.`,
      { maxTokens: 800, timeoutMs: 20_000 },
    )
    const p = parseJsonLoose(raw) ?? {}
    return {
      address: typeof p.address === 'string' ? p.address : null,
      zonaprop_url: typeof p.zonaprop_url === 'string' ? p.zonaprop_url : null,
      total_area: num(p.total_area),
      covered_area: num(p.covered_area),
      price: num(p.price),
      usd_per_m2: num(p.usd_per_m2),
      days_on_market: num(p.days_on_market),
      views_per_day: num(p.views_per_day),
      age: ageFromConstructionYear(num(p.construction_year)),
    }
  }

  // ── landings ──────────────────────────────────────────────────

  async editLandingBlock(
    input: import('@vendepro/core').EditBlockInput,
  ): Promise<import('@vendepro/core').EditBlockResult> {
    const { BLOCK_DATA_SCHEMAS } = await import('@vendepro/core')
    const schema = (BLOCK_DATA_SCHEMAS as any)[input.blockType]
    if (!schema) {
      return { status: 'error', reason: 'schema_mismatch', detail: `tipo desconocido: ${input.blockType}` }
    }
    const brandVoice = input.brandVoice?.trim() || 'neutro profesional'
    const system = `Sos copywriter de landings inmobiliarias para Argentina (español rioplatense).
Devolvé SOLO un JSON válido con el \`data\` actualizado del bloque.
Reglas:
1. Mantené la estructura exacta del schema del bloque (no agregues ni quites campos).
2. NO cambies id ni type. Solo podés cambiar los campos de data.
3. NO cambies URLs de imágenes existentes.
4. Respondé en español rioplatense, tono: ${brandVoice}.
5. Respondé SOLO el JSON, sin explicaciones, sin markdown.`
    const user = `Block type: ${input.blockType}
Block actual: ${JSON.stringify(input.blockData)}
Pedido del usuario: ${input.prompt}`

    try {
      const opts = { maxTokens: 2000, timeoutMs: 30_000, temperature: 0.4 }
      const parsed = parseJsonLoose(await this.chat([{ role: 'system', content: system }, { role: 'user', content: user }], opts))
      if (parsed) {
        const ok = schema.safeParse(parsed)
        if (ok.success) return { status: 'ok', data: ok.data }
        const retry = `El intento anterior no pasó validación. Error: ${ok.error.message}.
Devolvé SOLO el JSON corregido del mismo bloque.
Block actual: ${JSON.stringify(input.blockData)}
Pedido del usuario: ${input.prompt}`
        const parsed2 = parseJsonLoose(await this.chat([{ role: 'system', content: system }, { role: 'user', content: retry }], opts))
        if (parsed2) {
          const re = schema.safeParse(parsed2)
          if (re.success) return { status: 'ok', data: re.data }
        }
      }
      return { status: 'error', reason: 'schema_mismatch' }
    } catch (e) {
      return toEditError(e)
    }
  }

  async editLandingGlobal(
    input: import('@vendepro/core').EditGlobalInput,
  ): Promise<import('@vendepro/core').EditGlobalResult> {
    const { BlocksArraySchema } = await import('@vendepro/core')
    const brandVoice = input.brandVoice?.trim() || 'neutro profesional'
    const system = `Sos copywriter de landings inmobiliarias para Argentina (español rioplatense).
Devolvé SOLO un JSON con { "blocks": [...] } — un array con los bloques actualizados.
Reglas:
1. Mantené la MISMA longitud del array, los MISMOS id y type en el MISMO orden.
2. Solo podés modificar el campo data de los bloques relevantes al pedido.
3. NO cambies URLs de imágenes.
4. Respondé en español rioplatense, tono: ${brandVoice}.
5. SOLO el JSON, sin markdown.`
    const user = `Blocks actuales: ${JSON.stringify(input.blocks)}
Pedido del usuario: ${input.prompt}`

    try {
      const raw = await this.chat(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { maxTokens: 4000, timeoutMs: 30_000, temperature: 0.4 },
      )
      const parsed = parseJsonLoose(raw) as { blocks?: unknown } | null
      if (parsed?.blocks) {
        const v = (BlocksArraySchema as any).safeParse(parsed.blocks)
        if (v.success && preservesStructure(input.blocks, v.data)) {
          return { status: 'ok', blocks: v.data }
        }
      }
      return { status: 'error', reason: 'schema_mismatch' }
    } catch (e) {
      return toEditError(e)
    }
  }
}

/**
 * `age` se calcula acá y no lo pide el prompt.
 *
 * Un LLM no sabe en qué año estamos: sobre un aviso que decía "Año de
 * construcción: 1998", cuatro de cinco modelos respondieron **26** años de
 * antigüedad en vez de 28, calculando contra su propio corte de entrenamiento
 * (2024). En una tasación ese error entra derecho al cálculo de valor. El modelo
 * lee el año, el sistema hace la resta.
 */
export function ageFromConstructionYear(
  year: number | null,
  now: Date = new Date(),
): number | null {
  if (year === null) return null
  const actual = now.getFullYear()
  // Un año de 4 dígitos, no futuro y no absurdo. Fuera de rango, null: es
  // preferible el campo vacío a una antigüedad inventada.
  if (!Number.isInteger(year) || year < 1800 || year > actual) return null
  return actual - year
}

/** Distingue el abort del timeout del resto, que antes salía todo como provider_error. */
function toEditError(e: unknown): { status: 'error'; reason: 'provider_error' | 'timeout'; detail?: string } {
  const err = e as { name?: string; message?: string }
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
    return { status: 'error', reason: 'timeout', detail: err.message }
  }
  return { status: 'error', reason: 'provider_error', detail: err?.message }
}

function preservesStructure(original: readonly any[], next: readonly any[]): boolean {
  if (original.length !== next.length) return false
  for (let i = 0; i < original.length; i++) {
    if (original[i].id !== next[i].id || original[i].type !== next[i].type) return false
  }
  return true
}
