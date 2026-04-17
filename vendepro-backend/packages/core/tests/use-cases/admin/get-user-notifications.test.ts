import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetUserNotificationsUseCase } from '../../../src/application/use-cases/admin/get-user-notifications'
import { Notification } from '../../../src/domain/entities/notification'

const makeNotification = (id: string) =>
  Notification.create({
    id,
    org_id: 'org_mg',
    user_id: 'user-1',
    kind: 'system',
    title: `Notificación ${id}`,
    body: null,
    link_url: null,
    read: false,
  })

const mockRepo = {
  findByUserId: vi.fn(),
  save: vi.fn(),
  markRead: vi.fn(),
}

describe('GetUserNotificationsUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls repo with default limit of 20', async () => {
    mockRepo.findByUserId.mockResolvedValue([])
    const useCase = new GetUserNotificationsUseCase(mockRepo)
    await useCase.execute('user-1', 'org_mg')
    expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-1', 'org_mg', 20)
  })

  it('forwards custom limit to repo', async () => {
    const notifications = [makeNotification('n1'), makeNotification('n2')]
    mockRepo.findByUserId.mockResolvedValue(notifications)
    const useCase = new GetUserNotificationsUseCase(mockRepo)
    const result = await useCase.execute('user-1', 'org_mg', 5)
    expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-1', 'org_mg', 5)
    expect(result).toHaveLength(2)
  })
})
