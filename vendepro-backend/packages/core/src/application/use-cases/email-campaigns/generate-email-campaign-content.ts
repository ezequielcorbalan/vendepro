import type { EmailContentGenerator, GenerateEmailContentInput, GeneratedEmailContent } from '../../ports/services/email-content-generator'
import { ValidationError } from '../../../domain/errors/validation-error'

/**
 * Genera un borrador de campaña con IA a partir del brief del usuario.
 * El resultado es SIEMPRE un borrador editable — nunca se envía solo.
 */
export class GenerateEmailCampaignContentUseCase {
  constructor(private readonly generator: EmailContentGenerator) {}

  async execute(input: GenerateEmailContentInput): Promise<GeneratedEmailContent> {
    if (!input.brief?.trim() || input.brief.trim().length < 10) {
      throw new ValidationError('Contanos qué querés comunicar (mínimo unas palabras) para generar el borrador')
    }
    return this.generator.generate({ ...input, brief: input.brief.trim() })
  }
}
