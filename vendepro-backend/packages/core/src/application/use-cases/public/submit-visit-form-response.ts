import type { VisitFormRepository } from '../../ports/repositories/visit-form-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { VisitFormResponse } from '../../../domain/entities/visit-form-response'
import { NotFoundError } from '../../../domain/errors/not-found'

// Local helper to create a NotFoundError without an id when slug is unknown
const notFoundBySlug = (slug: string) => new NotFoundError('VisitForm', slug)

export interface SubmitVisitFormResponseInput {
  slug: string
  visitor_name: string
  visitor_phone?: string | null
  visitor_email?: string | null
  responses?: Record<string, string>
}

export class SubmitVisitFormResponseUseCase {
  constructor(
    private readonly visitFormRepo: VisitFormRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SubmitVisitFormResponseInput): Promise<{ id: string }> {
    const result = await this.visitFormRepo.findByPublicSlug(input.slug)
    if (!result) throw notFoundBySlug(input.slug)

    const now = new Date().toISOString()
    const response = VisitFormResponse.create({
      id: this.ids.generate(),
      form_id: result.form.id,
      visitor_name: input.visitor_name,
      visitor_phone: input.visitor_phone ?? null,
      visitor_email: input.visitor_email ?? null,
      responses: input.responses ?? {},
      created_at: now,
    })

    await this.visitFormRepo.saveResponse(response)

    return { id: response.id }
  }
}
