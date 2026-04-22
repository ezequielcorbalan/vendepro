import type { PropertyVisitForm } from '../../../domain/entities/property-visit-form'

export interface PropertyVisitFormWithContext {
  form: PropertyVisitForm
  property: {
    id: string
    address: string
    neighborhood: string | null
    city: string | null
    cover_photo: string | null
    asking_price: number | null
    currency: string | null
  }
  org: {
    id: string
    name: string
    logo_url: string | null
    brand_color: string | null
  }
}

export interface PropertyVisitFormRepository {
  save(form: PropertyVisitForm): Promise<void>
  findById(id: string, orgId: string): Promise<PropertyVisitForm | null>
  findBySlug(slug: string): Promise<PropertyVisitForm | null>
  findBySlugWithContext(slug: string): Promise<PropertyVisitFormWithContext | null>
  listByProperty(propertyId: string, orgId: string): Promise<PropertyVisitForm[]>
  existsBySlug(slug: string): Promise<boolean>
}
