import type { AIService, LeadIntent, ComparablePropertyData } from '@vendepro/core'

export class AnthropicAIService implements AIService {
  constructor(private readonly apiKey: string) {}

  async extractLeadIntent(_text: string): Promise<LeadIntent> {
    throw new Error('Use GroqAIService for text intent extraction')
  }

  async extractLeadFromImage(_imageBase64: string, _mimeType?: string): Promise<LeadIntent> {
    throw new Error('Use GroqAIService for lead image extraction')
  }

  async transcribeAudio(_audioBuffer: ArrayBuffer, _mimeType: string): Promise<string> {
    throw new Error('Use GroqAIService for audio transcription')
  }

  async extractMetricsFromScreenshot(imageBase64: string): Promise<Record<string, unknown>> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
              },
              {
                type: 'text',
                text: 'Extrae las métricas de este portal inmobiliario (impresiones, visitas, consultas, llamadas, posición). Devuelve SOLO un JSON con campos: impressions, portal_visits, inquiries, phone_calls, ranking_position.',
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
    const data = await response.json() as any
    const content = data.content?.[0]?.text ?? '{}'

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      return {}
    }
  }

  async extractComparableFromScreenshot(imageBase64: string, mimeType: string = 'image/png'): Promise<ComparablePropertyData> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: imageBase64 },
              },
              {
                type: 'text',
                text: `Esta es una captura de una publicación inmobiliaria (probablemente Zonaprop, Argenprop o similar). Extraé los datos de la propiedad en JSON con esta forma exacta:

{
  "address": "calle y número o intersección, o null",
  "zonaprop_url": "URL si aparece visible, o null",
  "total_area": número en m² (superficie total) o null,
  "covered_area": número en m² (superficie cubierta) o null,
  "price": número en USD (sin signo, sin separadores) o null,
  "usd_per_m2": número (precio por m² en USD) o null,
  "days_on_market": número de días publicado, o null,
  "views_per_day": número de visualizaciones promedio diarias, o null,
  "age": antigüedad en años (número), o null
}

Reglas:
- Si el valor no aparece o es ambiguo, usá null.
- price siempre en USD. Si está en pesos, convertilo aproximadamente solo si hay tipo de cambio visible; sino null.
- Devolvé SOLO el JSON, sin explicaciones, sin markdown.`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
    const data = await response.json() as any
    const content = data.content?.[0]?.text ?? '{}'

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      // Sanitizar: aceptar solo los campos esperados, convertir números.
      return {
        address: typeof parsed.address === 'string' ? parsed.address : null,
        zonaprop_url: typeof parsed.zonaprop_url === 'string' ? parsed.zonaprop_url : null,
        total_area: Number.isFinite(Number(parsed.total_area)) ? Number(parsed.total_area) : null,
        covered_area: Number.isFinite(Number(parsed.covered_area)) ? Number(parsed.covered_area) : null,
        price: Number.isFinite(Number(parsed.price)) ? Number(parsed.price) : null,
        usd_per_m2: Number.isFinite(Number(parsed.usd_per_m2)) ? Number(parsed.usd_per_m2) : null,
        days_on_market: Number.isFinite(Number(parsed.days_on_market)) ? Number(parsed.days_on_market) : null,
        views_per_day: Number.isFinite(Number(parsed.views_per_day)) ? Number(parsed.views_per_day) : null,
        age: Number.isFinite(Number(parsed.age)) ? Number(parsed.age) : null,
      }
    } catch {
      return {}
    }
  }

  async editLandingBlock(_input: import('@vendepro/core').EditBlockInput): Promise<import('@vendepro/core').EditBlockResult> {
    // Implemented in Task 22.
    return { status: 'error', reason: 'provider_error', detail: 'not implemented yet' }
  }

  async editLandingGlobal(_input: import('@vendepro/core').EditGlobalInput): Promise<import('@vendepro/core').EditGlobalResult> {
    return { status: 'error', reason: 'provider_error', detail: 'not implemented yet' }
  }
}
