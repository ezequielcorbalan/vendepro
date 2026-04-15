import type { AIService, LeadIntent } from '@vendepro/core'

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class GroqAIService implements AIService {
  constructor(private readonly apiKey: string) {}

  async extractLeadIntent(text: string): Promise<LeadIntent> {
    const systemPrompt = `Eres un asistente de CRM inmobiliario. Extrae información de leads del texto proporcionado.
    Devuelve SOLO un JSON válido con los campos que puedas identificar:
    { full_name, phone, email, neighborhood, property_type, operation, notes, budget }
    Si no encuentras un campo, no lo incluyas. Solo incluye datos concretos.`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ] as GroqMessage[],
        temperature: 0.1,
        max_tokens: 500,
      }),
    })

    if (!response.ok) throw new Error(`Groq API error: ${response.status}`)

    const data = await response.json() as any
    const content = data.choices?.[0]?.message?.content ?? '{}'

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      return {}
    }
  }

  async transcribeAudio(audioBuffer: ArrayBuffer, mimeType: string): Promise<string> {
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), 'audio.webm')
    formData.append('model', 'whisper-large-v3')
    formData.append('language', 'es')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData,
    })

    if (!response.ok) throw new Error(`Groq transcription error: ${response.status}`)
    const data = await response.json() as any
    return data.text ?? ''
  }

  async extractMetricsFromScreenshot(_imageBase64: string): Promise<Record<string, unknown>> {
    // Groq doesn't support vision — this falls through to AnthropicAIService
    throw new Error('Use AnthropicAIService for screenshot analysis')
  }
}
