import type { LandingVersion } from '../../../domain/entities/landing-version'

export interface LandingVersionRepository {
  findById(id: string): Promise<LandingVersion | null>
  listByLanding(landingId: string, limit?: number): Promise<LandingVersion[]>
  save(version: LandingVersion): Promise<void>
  nextVersionNumber(landingId: string): Promise<number>
  pruneNonPublish(landingId: string, keepLatest: number): Promise<number>
}
