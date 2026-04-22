import type { AIService, LeadIntent } from '../../ports/services/ai-service'

export interface ExtractLeadFromImageInput {
  imageBase64: string
  mimeType?: string
}

// 8 MB of base64 ≈ 6 MB of decoded image. Groq vision tops out around 20 MB,
// but we cap lower to keep Worker CPU + ingress predictable.
const MAX_BASE64_BYTES = 8 * 1024 * 1024

const ALLOWED_MIME_PREFIX = 'image/'

export class ExtractLeadFromImageUseCase {
  constructor(private readonly ai: AIService) {}

  async execute(input: ExtractLeadFromImageInput): Promise<LeadIntent> {
    const b64 = input.imageBase64?.trim() ?? ''
    if (b64.length === 0) {
      const err = new Error('imageBase64 is required')
      ;(err as any).statusCode = 400
      throw err
    }
    if (b64.length > MAX_BASE64_BYTES) {
      const err = new Error(`image exceeds max size of ${MAX_BASE64_BYTES} bytes`)
      ;(err as any).statusCode = 413
      throw err
    }
    const mimeType = input.mimeType ?? 'image/jpeg'
    if (!mimeType.startsWith(ALLOWED_MIME_PREFIX)) {
      const err = new Error('mimeType must be image/*')
      ;(err as any).statusCode = 400
      throw err
    }
    return await this.ai.extractLeadFromImage(b64, mimeType)
  }
}
