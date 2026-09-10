import type { NotificationRepository } from '../../ports/repositories/notification-repository'

/**
 * Marca una notificación como leída. El filtro por user_id vive en el repo:
 * nadie puede marcar leídas las notificaciones de otro usuario.
 */
export class MarkNotificationReadUseCase {
  constructor(private readonly repo: NotificationRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    await this.repo.markRead(id, userId)
  }
}
