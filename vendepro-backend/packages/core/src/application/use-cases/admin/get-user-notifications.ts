import type { NotificationRepository } from '../../ports/repositories/notification-repository'
import type { Notification } from '../../../domain/entities/notification'

export class GetUserNotificationsUseCase {
  constructor(private readonly repo: NotificationRepository) {}

  async execute(userId: string, orgId: string, limit = 20): Promise<Notification[]> {
    return await this.repo.findByUserId(userId, orgId, limit)
  }
}
