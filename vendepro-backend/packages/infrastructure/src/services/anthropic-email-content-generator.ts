import type { EmailContentGenerator, GenerateEmailContentInput, GeneratedEmailContent } from '@vendepro/core'

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
- HTML de email: tabla o divs con estilos inline, ancho máximo 600px centrado, fondo #f7f7f8, tarjeta blanca con border-radius.
- Tipografía: font-family: Poppins, Arial, sans-serif.
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
}

/** Tolera fences de markdown y texto alrededor del JSON. */
function parseJsonLoose(raw: string): any | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
