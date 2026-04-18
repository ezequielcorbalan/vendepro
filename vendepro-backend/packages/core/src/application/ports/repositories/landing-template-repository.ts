import type { LandingTemplate } from '../../../domain/entities/landing-template'
import type { LandingKind } from '../../../domain/entities/landing'

export interface LandingTemplateRepository {
  findById(id: string): Promise<LandingTemplate | null>
  listVisibleTo(orgId: string, filters?: { kind?: LandingKind; onlyActive?: boolean }): Promise<LandingTemplate[]>
  save(template: LandingTemplate): Promise<void>
}
