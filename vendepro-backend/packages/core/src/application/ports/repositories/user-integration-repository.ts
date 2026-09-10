import type { UserIntegration } from '../../../domain/entities/user-integration'

export interface UserIntegrationRepository {
  findByUserAndProvider(userId: string, provider: string): Promise<UserIntegration | null>
  /**
   * Integración dueña de un canal de notificaciones de Google. La usa el
   * webhook, que llega sin sesión: el id de canal es lo único que identifica
   * de quién es el calendario que cambió.
   */
  findByGoogleChannelId(channelId: string): Promise<UserIntegration | null>
  /** Upsert por UNIQUE(user_id, provider). */
  save(integration: UserIntegration): Promise<void>
  delete(userId: string, provider: string): Promise<void>
}
