import type {
  EmailContentGenerator, GenerateEmailContentInput, GeneratedEmailContent,
  GenerateSequenceInput, GeneratedSequenceStep,
} from '@vendepro/core'

const KIND_HINTS: Record<string, string> = {
  nueva_propiedad: 'Presentación de una propiedad nueva en cartera. Destacá atributos concretos y cerrá con un llamado a coordinar visita.',
  newsletter: 'Newsletter periódico con novedades del mercado inmobiliario y de la inmobiliaria. Tono informativo y cercano.',
  seguimiento: 'Seguimiento post-tasación o post-visita. Tono personal, corto, orientado a retomar la conversación.',
  reactivacion: 'Reactivación de contactos fríos. Reconocé el tiempo pasado sin ser invasivo y ofrecé valor concreto.',
  otro: 'Email de marketing inmobiliario general.',
}

/**
 * Genera borradores de campañas de email con Claude.
 * Devuelve subject + preheader + HTML (responsive, inline styles)
 * + versión texto plano. Siempre borrador — el envío es del usuario.
 */
export class AnthropicEmailContentGenerator implements EmailContentGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly model = 'claude-sonnet-5',
  ) {}

  async generate(input: GenerateEmailContentInput): Promise<GeneratedEmailContent> {
    const brandColor = input.brandColor ?? '#ff007c'
    const orgName = input.orgName ?? 'la inmobiliaria'
    const kindHint = KIND_HINTS[input.kind ?? 'otro'] ?? KIND_HINTS.otro

    const system = `Sos un redactor experto en email marketing inmobiliario en Argentina (español rioplatense, voseo).
Generás emails que se leen bien en celular, con un solo llamado a la acción claro.

Reglas del HTML:
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
- NO inventes datos que el brief no menciona (precios, direcciones, métricas). Si falta un dato clave, dejá un placeholder entre corchetes, ej: [DIRECCIÓN].

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = (await response.json()) as any
    const raw: string = data?.content?.[0]?.text ?? ''
    const parsed = parseJsonLoose(raw)
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

    const system = `Sos un experto en secuencias de email marketing inmobiliario en Argentina (español rioplatense, voseo).
Diseñás secuencias "drip": varios emails coordinados que se envían espaciados en el tiempo, cada uno con un propósito distinto pero coherente con el conjunto (no repetir lo mismo).

Reglas de cada email (igual que un email suelto):
- HTML de email responsive, ancho máx 600px, estilos inline, fondo #f7f7f8, tarjeta blanca, font Poppins/Arial.
- Color primario: ${brandColor}. Un solo llamado a la acción por email.
- Podés usar {{nombre}} para personalizar. NO incluyas link de baja (lo agrega el sistema).
- No inventes datos (precios, direcciones). Usá placeholders [ASÍ] si faltan.

Reglas de la secuencia:
- El primer email suele tener delay_hours: 0 (sale al inscribirse).
- Los siguientes espaciados de forma realista (ej: 48, 72, 120 horas).
- Progresión lógica: presentación → valor → prueba social → cierre/CTA fuerte.

Respondé SOLO con un JSON válido sin markdown, un array de exactamente ${input.stepCount} objetos:
[{"delay_hours": 0, "subject": "...", "preheader": "...", "html": "...", "text": "..."}, ...]`

    const user = `Inmobiliaria: ${orgName}
${input.audienceDescription ? `Audiencia: ${input.audienceDescription}` : ''}
Cantidad de emails: ${input.stepCount}

Objetivo de la secuencia:
${input.brief}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = (await response.json()) as any
    const raw: string = data?.content?.[0]?.text ?? ''
    const parsed = parseJsonLoose(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('La IA devolvió un formato inesperado — probá de nuevo')
    }
    return parsed.map((s: any, i: number): GeneratedSequenceStep => ({
      delay_hours: typeof s?.delay_hours === 'number' ? s.delay_hours : (i === 0 ? 0 : 72),
      subject: String(s?.subject ?? ''),
      preheader: String(s?.preheader ?? ''),
      html: String(s?.html ?? ''),
      text: String(s?.text ?? ''),
    }))
  }
}

/** Tolera fences de markdown y texto alrededor del JSON (objeto o array). */
function parseJsonLoose(raw: string): any | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Recorta al primer delimitador de apertura ({ o [) y su cierre correspondiente.
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
