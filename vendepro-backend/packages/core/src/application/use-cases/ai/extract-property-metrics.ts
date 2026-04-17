import type { AIService } from '../../ports/services/ai-service'

export interface ExtractPropertyMetricsInput {
  imageBase64: string
}

export class ExtractPropertyMetricsUseCase {
  constructor(private readonly ai: AIService) {}

  async execute(input: ExtractPropertyMetricsInput): Promise<Record<string, unknown>> {
    if (!input.imageBase64 || input.imageBase64.trim().length === 0) {
      throw new Error('imageBase64 is required')
    }
    return await this.ai.extractMetricsFromScreenshot(input.imageBase64)
  }
}
