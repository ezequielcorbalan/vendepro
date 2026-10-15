import { DOC_TYPES, DOC_TYPE_LABELS, isDocType } from '@vendepro/core'
import type {
  AuthorizationTerms,
  DocumentClassification,
  DocumentClassifier,
  DocumentClassifierInput,
} from '@vendepro/core'
import { parseJsonLoose } from './gemini-ai-service'

const NATIVE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
/** Mismo modelo que el resto de la IA de VendéPro (ver gemini-ai-service). */
const MODEL = 'gemini-3.5-flash-lite'
/** Gemini acepta hasta ~20 MB inline; el portal ya corta en 15. */
const MAX_INLINE_BYTES = 18 * 1024 * 1024
const TIMEOUT_MS = 45_000

const CATALOG = DOC_TYPES.map((t) => `- ${t}: ${DOC_TYPE_LABELS[t]}`).join('\n')

function buildPrompt(declared: string | null): string {
  return `Sos un asistente de una inmobiliaria argentina. Te paso UN documento (PDF o foto) que mandó el propietario de una propiedad.
Decí cuál es, eligiendo SOLO de este catálogo:
${CATALOG}
${declared ? `\nEl propietario dijo que es "${declared}". Usalo como pista, pero si el documento claramente es otro, decí el que es.\n` : ''}
Respondé SOLO este JSON, sin markdown:
{
  "tipo": "<una clave del catálogo>",
  "fecha_emision": "YYYY-MM-DD o null (fecha de emisión, de firma o del período facturado)",
  "autorizacion": null o { "inicio": "YYYY-MM-DD o null", "plazo_dias": número o null, "fin": "YYYY-MM-DD o null", "exclusiva": true/false/null },
  "observaciones": "una línea útil para el agente (ej. 'falta el dorso', 'está vencido', 'ilegible') o null"
}

Reglas:
- "autorizacion" sólo si tipo es autorizacion_venta; si no, null. Si el plazo está en meses, pasalo a días (mes = 30).
- Si no se puede leer o no es ninguno del catálogo, tipo = "otro".
- Fechas siempre YYYY-MM-DD. Si sólo hay mes y año, usá el día 01. Si no hay fecha, null.
- No inventes: ante la duda, null.`
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const date = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null

function toAuthorization(raw: any): AuthorizationTerms | null {
  if (!raw || typeof raw !== 'object') return null
  const days = Number(raw.plazo_dias)
  const terms: AuthorizationTerms = {
    startDate: date(raw.inicio),
    durationDays: Number.isFinite(days) && days > 0 ? Math.round(days) : null,
    endDate: date(raw.fin),
    exclusive: typeof raw.exclusiva === 'boolean' ? raw.exclusiva : null,
  }
  return terms.startDate || terms.durationDays || terms.endDate ? terms : null
}

/** Normaliza la respuesta del modelo al contrato del puerto. Exportada para test. */
export function toClassification(raw: any): DocumentClassification {
  const docType = isDocType(raw?.tipo) ? raw.tipo : 'otro'
  const observations = typeof raw?.observaciones === 'string' && raw.observaciones.trim()
    ? raw.observaciones.trim().slice(0, 300)
    : null
  return {
    docType,
    issuedAt: date(raw?.fecha_emision),
    authorization: docType === 'autorizacion_venta' ? toAuthorization(raw?.autorizacion) : null,
    observations,
  }
}

/**
 * Clasificador de documentos con la API nativa de Gemini: es la única que
 * acepta PDF inline (`inline_data`), igual que la lectura de reportes de
 * KiteProp. Lee el documento entero sin parsear PDF dentro del Worker.
 */
export class GeminiDocumentClassifier implements DocumentClassifier {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  /**
   * Contrato de errores (lo necesita el barrido de Drive, que es idempotente
   * por archivo): todo lo que es del PROVEEDOR o de configuración — sin API
   * key, red, timeout, 429, 5xx — TIRA, para que se reintente. Sólo un
   * documento que no se puede leer o no está en el catálogo vuelve como 'otro'.
   */
  async classify(input: DocumentClassifierInput): Promise<DocumentClassification> {
    const mime = input.mimeType || (/\.pdf$/i.test(input.fileName) ? 'application/pdf' : 'image/jpeg')
    if (!this.apiKey) throw new Error('GEMINI_API_KEY no configurada: no se puede clasificar')
    if (input.data.size > MAX_INLINE_BYTES) {
      return { docType: 'otro', issuedAt: null, authorization: null, observations: 'Muy grande para leer automáticamente' }
    }

    const declared = input.declaredType && input.declaredType !== 'otro' ? DOC_TYPE_LABELS[input.declaredType] : null
    const res = await this.fetchFn(`${NATIVE_BASE_URL}/${MODEL}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mime, data: await toBase64(input.data) } },
            { text: buildPrompt(declared) },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800, responseMimeType: 'application/json' },
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`)
    }
    const data = (await res.json()) as any
    const raw: string = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('')
    return toClassification(parseJsonLoose(raw) ?? {})
  }
}
