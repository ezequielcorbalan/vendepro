// packages/core/src/application/ports/repositories/organization-repository.ts
import type { Organization } from '../../../domain/entities/organization'

export interface OrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>
  save(org: Organization): Promise<void>
}
