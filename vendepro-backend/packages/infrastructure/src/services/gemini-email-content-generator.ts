import type {
  EmailContentGenerator, GenerateEmailContentInput, GeneratedEmailContent,
  GenerateSequenceInput, GeneratedSequenceStep,
} from '@vendepro/core'
import { providerError } from './provider-error'
import { parseJsonLoose } from './gemini-ai-service'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const MODEL = 'gemini-3.5-flash-lite'

const KIND_HINTS: Record<string, string> = {
  nueva_propiedad: 'Presentación de una propiedad nueva en cartera. Destacá atributos concretos y cerrá con un llamado a coordinar visita.',
  newsletter: 'Newsletter periódico con novedades del mercado inmobiliario y de la inmobiliaria. Tono informativo y cercano.',
  seguimiento: 'Seguimiento post-tasación o post-visita. Tono personal, corto, orientado a retomar la conversación.',
  reactivacion: 'Reactivación de contactos fríos. Reconocé el tiempo pasado sin ser invasivo y ofrecé valor concreto.',
  otro: 'Email de marketing inmobiliario general.',
}

/**
 * Reglas del HTML, compartidas por el email suelto y por cada paso de una
 * secuencia. Están en una sola constante A PROPÓSITO: antes vivían duplicadas y
 * habían divergido — el prompt de campaña prohibía la tarjeta y el de secuencia
 * la pedía ("fondo #f7f7f8, tarjeta blanca"). Los dos caminos de envío envuelven
 * con `renderEmailHtml` (`process-email-queue` vía `email-shared/personalize`, y
 * `automation-executors.ts:95`), así que la secuencia producía una tarjeta
 * adentro de otra.
 */
function reglasHtml(brandColor: string): string {
  return `Reglas del HTML:
- Devolvé SOLO el contenido del mensaje (párrafos, títulos, botón). El sistema lo
  envuelve después en el template base de VendéPro, que ya trae el documento HTML,
  la tarjeta blanca de 600px, el encabezado con el logo y el footer.
- NO incluyas <!DOCTYPE>, <html>, <head>, <body> ni una tarjeta/fondo propios:
  quedaría una tarjeta adentro de otra.
- Estilos inline en cada etiqueta (los clientes de email ignoran el CSS del head).
- Tipografía: no la declares, la hereda del template.
- Color primario para botones/acentos: ${brandColor}.
- Podés usar la variable {{nombre}} para personalizar (se reemplaza por el nombre del destinatario).
- NO incluyas link de "cancelar suscripción" — el sistema lo agrega solo.
- NO inventes datos que el brief no menciona (precios, direcciones, métricas). Si
  falta un dato clave, dejá un placeholder entre corchetes, ej: [DIRECCIÓN].`
}

/**
 * Genera borradores de email con Gemini. Siempre borrador: la IA nunca envía.
 */
export class GeminiEmailContentGenerator implements EmailContentGenerator {
  constructor(private readonly apiKey: string) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      const err = new Error(
        'Falta GEMINI_API_KEY en el worker. La generación de emails con IA no puede funcionar hasta que se configure.',
      ) as Error & { statusCode: number }
      err.statusCode = 503
      throw err
    }
  }

  private async chat(system: string, user: string, maxTokens: number): Promise<string> {
    const controller = new AbortController()
    // 30 s y no 15: una campaña con HTML completo se midió en 15,3 s. Con el
    // techo anterior habría abortado justo al final.
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error(`[GeminiEmailContentGenerator] ${res.status} ${body.slice(0, 500)}`)
        throw providerError(res.status, body, { provider: 'gemini' })
      }
      const data = (await res.json()) as any
      return data.choices?.[0]?.message?.content ?? ''
    } finally {
      clearTimeout(timeout)
    }
  }

  async generate(input: GenerateEmailContentInput): Promise<GeneratedEmailContent> {
    const brandColor = input.brandColor ?? '#ff007c'
    const orgName = input.orgName ?? 'la inmobiliaria'
    const kindHint = KIND_HINTS[input.kind ?? 'otro'] ?? KIND_HINTS.otro

    const system = `Sos un redactor experto en email marketing inmobiliario en Argentina (español rioplatense, voseo).
Generás emails que se leen bien en celular, con un solo llamado a la acción claro.

${reglasHtml(brandColor)}

Respondé SOLO con un objeto JSON válido, sin markdown, con esta forma exacta:
{"subject": "...", "preheader": "...", "html": "...", "text": "..."}
- subject: máx 60 caracteres, concreto, sin clickbait.
- preheader: máx 90 caracteres, complementa el subject.
- text: versión texto plano del mismo contenido.`

    const user = `Inmobiliaria: ${orgName}
Tipo de campaña: ${kindHint}
${input.audienceDescription ? `Audiencia: ${input.audienceDescription}` : ''}

Brief del usuario:
${input.brief}`

    const parsed = parseJsonLoose(await this.chat(system, user, 4000))
    if (!parsed?.subject || !parsed?.html) {
      throw new Error('La IA devolvió un formato inesperado — probá de nuevo')
    }
    return {
      subject: String(parsed.subject),
      preheader: String(parsed.preheader ?? ''),
      html: String(parsed.html),
      text: String(parsed.text ?? ''),
    }
  }

  async generateSequence(input: GenerateSequenceInput): Promise<GeneratedSequenceStep[]> {
    const brandColor = input.brandColor ?? '#ff007c'
    const orgName = input.orgName ?? 'la inmobiliaria'
    const n = Math.max(1, Math.min(10, Math.trunc(input.stepCount) || 3))

    const system = `Sos un experto en secuencias de email marketing inmobiliario en Argentina (español rioplatense, voseo).
Diseñás secuencias "drip": varios emails coordinados que se envían espaciados en el tiempo, cada uno con un propósito distinto pero coherente con el conjunto (nunca repetir lo mismo).

${reglasHtml(brandColor)}

Reglas de la secuencia:
- El primer email lleva delay_hours: 0 (sale al inscribirse).
- Los siguientes espaciados de forma realista (ej: 48, 72, 120 horas).
- Progresión lógica: presentación → valor → prueba social → cierre/CTA fuerte.
- subject de cada email: máx 60 caracteres. preheader: máx 90.

Respondé SOLO con un JSON válido sin markdown, un array de EXACTAMENTE ${n} objetos:
[{"delay_hours": 0, "subject": "...", "preheader": "...", "html": "...", "text": "..."}, ...]`

    const user = `Inmobiliaria: ${orgName}
${input.audienceDescription ? `Audiencia: ${input.audienceDescription}` : ''}
Cantidad de emails: ${n}

Objetivo de la secuencia:
${input.brief}`

    // `max_tokens` acotado a propósito: el proveedor cuenta el máximo PEDIDO
    // contra la cuota por minuto, así que pedir de más hace rebotar el request
    // entero con `request_too_large` aunque la respuesta fuera a ser corta.
    const parsed = parseJsonLoose(await this.chat(system, user, 4000))
    const arr = Array.isArray(parsed) ? parsed : (parsed?.steps ?? null)
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error('La IA devolvió un formato inesperado — probá de nuevo')
    }
    if (arr.length !== n) {
      // Antes sólo se chequeaba `length > 0`: si el modelo devolvía 2 cuando
      // pediste 5, la UI armaba 2 acciones y nadie se enteraba.
      throw new Error(`La IA devolvió ${arr.length} emails y se pidieron ${n} — probá de nuevo`)
    }
    return arr.map((s: any, i: number): GeneratedSequenceStep => ({
      delay_hours: typeof s?.delay_hours === 'number' ? s.delay_hours : (i === 0 ? 0 : 72),
      subject: String(s?.subject ?? ''),
      preheader: String(s?.preheader ?? ''),
      html: String(s?.html ?? ''),
      text: String(s?.text ?? ''),
    }))
  }
}
