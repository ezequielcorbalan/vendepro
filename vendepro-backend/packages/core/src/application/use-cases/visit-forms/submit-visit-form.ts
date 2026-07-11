import type { PropertyVisitFormRepository } from '../../ports/repositories/property-visit-form-repository'
import type { LeadPropertyRepository } from '../../ports/repositories/lead-property-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import type {
  BuyIntention,
  VisitSource,
  VisitSituation,
} from '../../../domain/entities/property-visit-form'

export interface SubmitVisitFormInput {
  slug: string
  visitor_name?: string | null
  visitor_email?: string | null
  visitor_phone?: string | null
  rating?: number | null
  liked?: string | null
  disliked?: string | null
  subjective_price_usd?: number | null
  buy_intention?: BuyIntention | null
  source?: VisitSource | null
  situation?: VisitSituation | null
  observations?: string | null
}

/**
 * Endpoint público (sin auth): recibe las respuestas del visitante y marca
 * la ficha como enviada (submitted_at). Idempotente sobre el slug, pero si
 * la ficha ya fue enviada, se sobreescribe (último envío gana).
 */
export class SubmitVisitFormUseCase {
  constructor(
    private readonly repo: PropertyVisitFormRepository,
    // Opcional: si la ficha nació de un lead comprador, marca la relación 'visitada'.
    private readonly leadPropertyRepo?: LeadPropertyRepository,
  ) {}

  async execute(input: SubmitVisitFormInput): Promise<{ id: string }> {
    const form = await this.repo.findBySlug(input.slug)
    if (!form) throw new NotFoundError('PropertyVisitForm', input.slug)

    form.submit({
      visitor_name: input.visitor_name ?? null,
      visitor_email: input.visitor_email ?? null,
      visitor_phone: input.visitor_phone ?? null,
      rating:
        typeof input.rating === 'number' && !Number.isNaN(input.rating) ? input.rating : null,
      liked: input.liked ?? null,
      disliked: input.disliked ?? null,
      subjective_price_usd:
        typeof input.subjective_price_usd === 'number' && !Number.isNaN(input.subjective_price_usd)
          ? input.subjective_price_usd
          : null,
      buy_intention: input.buy_intention ?? null,
      source: input.source ?? null,
      situation: input.situation ?? null,
      observations: input.observations ?? null,
    })

    await this.repo.save(form)

    // Feedback → lead_properties: la relación del lead con la propiedad visitada
    // pasa a 'visitada' con el resumen de la ficha. Best-effort (público, sin auth):
    // un fallo acá no voltea el submit.
    if (this.leadPropertyRepo && form.lead_id) {
      try {
        const relation = await this.leadPropertyRepo.findByLeadAndProperty(form.lead_id, form.property_id, form.org_id)
        if (relation) {
          relation.updateStatus('visitada', this.composeFeedback(form))
          await this.leadPropertyRepo.save(relation)
        }
      } catch { /* best-effort */ }
    }

    return { id: form.id }
  }

  private composeFeedback(form: { rating: number | null; liked: string | null; disliked: string | null; buy_intention: string | null }): string {
    const intentionLabel: Record<string, string> = { compraria: 'Compraría', tal_vez: 'Tal vez', no: 'No compraría' }
    const parts: string[] = []
    if (form.buy_intention) parts.push(intentionLabel[form.buy_intention] ?? form.buy_intention)
    if (form.rating != null) parts.push(`${form.rating}/5`)
    if (form.liked) parts.push(`Le gustó: ${form.liked}`)
    if (form.disliked) parts.push(`No le gustó: ${form.disliked}`)
    return parts.join(' · ')
  }
}
