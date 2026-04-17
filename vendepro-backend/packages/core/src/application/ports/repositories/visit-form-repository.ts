import type { VisitForm } from '../../../domain/entities/visit-form'
import type { VisitFormResponse } from '../../../domain/entities/visit-form-response'

export interface VisitFormRepository {
  findById(id: string, orgId: string): Promise<VisitForm | null>
  findByPublicSlug(slug: string): Promise<{
    form: VisitForm
    property: { address: string; neighborhood: string }
    org: { name: string; logo_url: string | null; brand_color: string | null }
  } | null>
  save(form: VisitForm): Promise<void>
  saveResponse(response: VisitFormResponse): Promise<void>
}
