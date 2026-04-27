import type { AIService, ComparablePropertyData } from '../../ports/services/ai-service'

export interface ExtractComparableFromScreenshotInput {
  imageBase64: string
  mimeType?: string
}

export class ExtractComparableFromScreenshotUseCase {
  constructor(private readonly ai: AIService) {}

  async execute(input: ExtractComparableFromScreenshotInput): Promise<ComparablePropertyData> {
    if (!input.imageBase64 || input.imageBase64.trim().length === 0) {
      const err = new Error('imageBase64 is required') as Error & { statusCode: number }
      err.statusCode = 400
      throw err
    }
    return await this.ai.extractComparableFromScreenshot(input.imageBase64, input.mimeType)
  }
}
