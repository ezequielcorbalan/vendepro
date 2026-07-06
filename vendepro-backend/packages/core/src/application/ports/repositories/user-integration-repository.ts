import type { UserIntegration } from '../../../domain/entities/user-integration'

export interface UserIntegrationRepository {
  findByUserAndProvider(userId: string, provider: string): Promise<UserIntegration | null>
  /** Upsert por UNIQUE(user_id, provider). */
  save(integration: UserIntegration): Promise<void>
  delete(userId: string, provider: string): Promise<void>
}
