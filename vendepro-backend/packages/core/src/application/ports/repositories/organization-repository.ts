// packages/core/src/application/ports/repositories/organization-repository.ts
import type { Organization } from '../../../domain/entities/organization'

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>
  findBySlug(slug: string): Promise<Organization | null>
  findByApiKey(apiKey: string): Promise<Organization | null>
  save(org: Organization): Promise<void>
  updateSettings(id: string, patch: Partial<{ name: string; slug: string; logo_url: string | null; brand_color: string | null; canva_template_id: string | null; canva_report_template_id: string | null }>): Promise<void>
  setApiKey(id: string, apiKey: string): Promise<void>
  getApiKey(id: string): Promise<string | null>
}
