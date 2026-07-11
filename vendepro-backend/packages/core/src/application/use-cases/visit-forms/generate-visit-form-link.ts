import type { PropertyVisitFormRepository } from '../../ports/repositories/property-visit-form-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { PropertyVisitForm } from '../../../domain/entities/property-visit-form'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface GenerateVisitFormLinkInput {
  org_id: string
  agent_id: string
  property_id: string
  /** Lead comprador que va a visitar (opcional): linkea el feedback a lead_properties. */
  lead_id?: string | null
}

export interface GenerateVisitFormLinkOutput {
  id: string
  slug: string
}

/**
 * Crea un registro de Ficha de Visita "pending" (sin respuestas) y devuelve
 * el slug público. El agente puede compartir /v/<slug> con el visitante.
 */
export class GenerateVisitFormLinkUseCase {
  constructor(
    private readonly repo: PropertyVisitFormRepository,
    private readonly propertyRepo: PropertyRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: GenerateVisitFormLinkInput): Promise<GenerateVisitFormLinkOutput> {
    // Validate property exists & belongs to org
    const property = await this.propertyRepo.findById(input.property_id, input.org_id)
    if (!property) throw new NotFoundError('Property', input.property_id)

    // Generate unique slug (retry if collision)
    let slug = this.buildSlug()
    let attempts = 0
    while (attempts < 5 && (await this.repo.existsBySlug(slug))) {
      slug = this.buildSlug()
      attempts++
    }

    const id = this.ids.generate()
    const form = PropertyVisitForm.create({
      id,
      org_id: input.org_id,
      agent_id: input.agent_id,
      property_id: input.property_id,
      lead_id: input.lead_id ?? null,
      slug,
      visitor_name: null,
      visitor_email: null,
      visitor_phone: null,
      rating: null,
      liked: null,
      disliked: null,
      subjective_price_usd: null,
      buy_intention: null,
      source: null,
      situation: null,
      observations: null,
    })

    await this.repo.save(form)
    return { id: form.id, slug: form.slug }
  }

  private buildSlug(): string {
    // Short URL-friendly slug: 10 lowercase alphanumeric chars
    const raw = this.ids.generate().replace(/[^a-z0-9]/gi, '').toLowerCase()
    return raw.slice(0, 10).padEnd(10, '0')
  }
}
