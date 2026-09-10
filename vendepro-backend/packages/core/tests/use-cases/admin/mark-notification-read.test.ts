import { describe, it, expect, vi } from 'vitest'
import { MarkNotificationReadUseCase } from '../../../src/application/use-cases/admin/mark-notification-read'

describe('MarkNotificationReadUseCase', () => {
  it('delega en el repo con id y userId (el repo filtra por dueño)', async () => {
    const repo = { findByUserId: vi.fn(), save: vi.fn(), markRead: vi.fn().mockResolvedValue(undefined) }
    const useCase = new MarkNotificationReadUseCase(repo)
    await useCase.execute('n1', 'user-1')
    expect(repo.markRead).toHaveBeenCalledWith('n1', 'user-1')
  })
})
