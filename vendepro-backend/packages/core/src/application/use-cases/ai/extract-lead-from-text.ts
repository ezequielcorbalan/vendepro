import type { AIService, LeadIntent } from '../../ports/services/ai-service'

export interface ExtractLeadFromTextInput {
  text: string
}

const MAX_TEXT_LENGTH = 8_000

export class ExtractLeadFromTextUseCase {
  constructor(private readonly ai: AIService) {}

  async execute(input: ExtractLeadFromTextInput): Promise<LeadIntent> {
    const text = input.text?.trim() ?? ''
    if (text.length === 0) {
      const err = new Error('text is required')
      ;(err as any).statusCode = 400
      throw err
    }
    if (text.length > MAX_TEXT_LENGTH) {
      const err = new Error(`text exceeds max length of ${MAX_TEXT_LENGTH} chars`)
      ;(err as any).statusCode = 413
      throw err
    }
    return await this.ai.extractLeadIntent(text)
  }
}
