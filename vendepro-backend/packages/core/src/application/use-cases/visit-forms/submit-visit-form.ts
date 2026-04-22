import type { PropertyVisitFormRepository } from '../../ports/repositories/property-visit-form-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import type { BuyIntention } from '../../../domain/entities/property-visit-form'

export interface SubmitVisitFormInput {
  slug: string
  visitor_name?: string | null
  visitor_email?: string | null
  visitor_phone?: string | null
  liked?: string | null
  disliked?: string | null
  subjective_price_usd?: number | null
  buy_intention?: BuyIntention | null
  observations?: string | null
}

/**
 * Endpoint público (sin auth): recibe las respuestas del visitante y marca
 * la ficha como enviada (submitted_at). Idempotente sobre el slug, pero si
 * la ficha ya fue enviada, se sobreescribe (último envío gana).
 */
export class SubmitVisitFormUseCase {
  constructor(private readonly repo: PropertyVisitFormRepository) {}

  async execute(input: SubmitVisitFormInput): Promise<{ id: string }> {
    const form = await this.repo.findBySlug(input.slug)
    if (!form) throw new NotFoundError('PropertyVisitForm', input.slug)

    form.submit({
      visitor_name: input.visitor_name ?? null,
      visitor_email: input.visitor_email ?? null,
      visitor_phone: input.visitor_phone ?? null,
      liked: input.liked ?? null,
      disliked: input.disliked ?? null,
      subjective_price_usd:
        typeof input.subjective_price_usd === 'number' && !Number.isNaN(input.subjective_price_usd)
          ? input.subjective_price_usd
          : null,
      buy_intention: input.buy_intention ?? null,
      observations: input.observations ?? null,
    })

    await this.repo.save(form)
    return { id: form.id }
  }
}
