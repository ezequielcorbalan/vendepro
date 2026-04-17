import type { Notification } from '../../../domain/entities/notification'

export interface NotificationRepository {
  findByUserId(userId: string, orgId: string, limit?: number): Promise<Notification[]>
  save(notification: Notification): Promise<void>
  markRead(id: string, userId: string): Promise<void>
}
