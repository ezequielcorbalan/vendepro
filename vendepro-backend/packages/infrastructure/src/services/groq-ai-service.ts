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

  async editLandingBlock(input: import('@vendepro/core').EditBlockInput): Promise<import('@vendepro/core').EditBlockResult> {
    const { BLOCK_DATA_SCHEMAS } = await import('@vendepro/core')
    const schema = (BLOCK_DATA_SCHEMAS as any)[input.blockType]
    if (!schema) return { status: 'error', reason: 'schema_mismatch', detail: `tipo desconocido: ${input.blockType}` }

    const brandVoice = input.brandVoice?.trim() || 'neutro profesional'
    const systemPrompt = `Sos copywriter de landings inmobiliarias para Argentina (español rioplatense).
Devolvé SOLO un JSON válido con el \`data\` actualizado del bloque.
Reglas:
1. Mantené la estructura exacta del schema del bloque (no agregues ni quites campos).
2. NO cambies id ni type. Solo podés cambiar los campos de data.
3. NO cambies URLs de imágenes existentes.
4. Respondé en español rioplatense, tono: ${brandVoice}.
5. Respondé SOLO el JSON, sin explicaciones, sin markdown.`

    const userPrompt = `Block type: ${input.blockType}
Block actual: ${JSON.stringify(input.blockData)}
Pedido del usuario: ${input.prompt}`

    try {
      const raw = await this.callGroq(systemPrompt, userPrompt)
      const parsed = this.safeParseJson(raw)
      if (parsed) {
        const validated = schema.safeParse(parsed)
        if (validated.success) return { status: 'ok', data: validated.data }
        const retryUser = `El intento anterior no pasó validación. Error: ${validated.error.message}.
Devolvé SOLO el JSON corregido del mismo bloque.
Block actual: ${JSON.stringify(input.blockData)}
Pedido del usuario: ${input.prompt}`
        const raw2 = await this.callGroq(systemPrompt, retryUser)
        const parsed2 = this.safeParseJson(raw2)
        if (parsed2) {
          const re = schema.safeParse(parsed2)
          if (re.success) return { status: 'ok', data: re.data }
        }
      }
      return { status: 'error', reason: 'schema_mismatch' }
    } catch (e) {
      return { status: 'error', reason: 'provider_error', detail: (e as Error).message }
    }
  }

  async editLandingGlobal(input: import('@vendepro/core').EditGlobalInput): Promise<import('@vendepro/core').EditGlobalResult> {
    const { BlocksArraySchema } = await import('@vendepro/core')
    const brandVoice = input.brandVoice?.trim() || 'neutro profesional'

    const systemPrompt = `Sos copywriter de landings inmobiliarias para Argentina (español rioplatense).
Devolvé SOLO un JSON con { "blocks": [...] } — un array con los bloques actualizados.
Reglas:
1. Mantené la MISMA longitud del array, los MISMOS id y type en el MISMO orden.
2. Solo podés modificar el campo data de los bloques relevantes al pedido.
3. NO cambies URLs de imágenes.
4. Respondé en español rioplatense, tono: ${brandVoice}.
5. SOLO el JSON, sin markdown.`

    const userPrompt = `Blocks actuales: ${JSON.stringify(input.blocks)}
Pedido del usuario: ${input.prompt}`

    try {
      const raw = await this.callGroq(systemPrompt, userPrompt)
      const parsed = this.safeParseJson(raw) as { blocks?: unknown } | null
      if (parsed?.blocks) {
        const v = (BlocksArraySchema as any).safeParse(parsed.blocks)
        if (v.success && this.preservesStructure(input.blocks, v.data)) {
          return { status: 'ok', blocks: v.data }
        }
      }
      return { status: 'error', reason: 'schema_mismatch' }
    } catch (e) {
      return { status: 'error', reason: 'provider_error', detail: (e as Error).message }
    }
  }

  private preservesStructure(original: readonly any[], next: readonly any[]): boolean {
    if (original.length !== next.length) return false
    for (let i = 0; i < original.length; i++) {
      if (original[i].id !== next[i].id || original[i].type !== next[i].type) return false
    }
    return true
  }

  private safeParseJson(raw: string): unknown | null {
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      return match ? JSON.parse(match[0]) : null
    } catch { return null }
  }

  private async callGroq(system: string, user: string): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      })
      if (!res.ok) throw new Error(`Groq ${res.status}`)
      const data = await res.json() as any
      return data.choices?.[0]?.message?.content ?? ''
    } finally {
      clearTimeout(timeout)
    }
  }
}
