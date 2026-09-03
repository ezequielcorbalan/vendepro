import type { AIService } from '../../ports/services/ai-service'

export interface ExtractPropertyMetricsInput {
  imageBase64: string
  /** Tipo real de la imagen. Sin esto el servicio la declaraba siempre como PNG
   *  y un screenshot JPEG rebotaba con 400 en el proveedor. */
  mimeType?: string
}

export class ExtractPropertyMetricsUseCase {
  constructor(private readonly ai: AIService) {}

  async execute(input: ExtractPropertyMetricsInput): Promise<Record<string, unknown>> {
    if (!input.imageBase64 || input.imageBase64.trim().length === 0) {
      throw new Error('imageBase64 is required')
    }
    return await this.ai.extractMetricsFromScreenshot(input.imageBase64, input.mimeType)
  }
}
