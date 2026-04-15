import type { AIService, LeadIntent } from '@reportes/core'

export class AnthropicAIService implements AIService {
  constructor(private readonly apiKey: string) {}

  async extractLeadIntent(_text: string): Promise<LeadIntent> {
    throw new Error('Use GroqAIService for text intent extraction')
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
}
