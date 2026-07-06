import type { EmailAudienceRepository } from '../../ports/repositories/email-audience-repository'
import type { CampaignSegment } from '../../../domain/entities/email-campaign'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface PreviewAudienceResult {
  count: number
  sample: Array<{ email: string; name: string | null }>
}

/** Conteo en vivo + muestra para el paso "Audiencia" del wizard. */
export class PreviewCampaignAudienceUseCase {
  constructor(private readonly audienceRepo: EmailAudienceRepository) {}

  async execute(orgId: string, segment: CampaignSegment): Promise<PreviewAudienceResult> {
    if (segment?.source !== 'contacts' && segment?.source !== 'leads') {
      throw new ValidationError('Segmento inválido: source debe ser contacts o leads')
    }
    const recipients = await this.audienceRepo.resolve(orgId, segment)
    return {
      count: recipients.length,
      sample: recipients.slice(0, 5).map(r => ({ email: r.email, name: r.name })),
    }
  }
}
