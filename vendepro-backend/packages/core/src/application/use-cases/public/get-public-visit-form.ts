import type { VisitFormRepository } from '../../ports/repositories/visit-form-repository'
import type { VisitForm } from '../../../domain/entities/visit-form'

export interface GetPublicVisitFormResult {
  form: VisitForm
  property: { address: string; neighborhood: string }
  org: { name: string; logo_url: string | null; brand_color: string | null }
}

export class GetPublicVisitFormUseCase {
  constructor(private readonly visitFormRepo: VisitFormRepository) {}

  async execute(slug: string): Promise<GetPublicVisitFormResult | null> {
    return this.visitFormRepo.findByPublicSlug(slug)
  }
}
