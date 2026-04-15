import { describe, it, expect, vi } from 'vitest'
import { ToggleEventCompleteUseCase } from '../../../src/application/use-cases/calendar/toggle-event-complete'
import { CalendarEvent } from '../../../src/domain/entities/calendar-event'
import { NotFoundError } from '../../../src/domain/errors/not-found'

const mockEvent = CalendarEvent.create({
  id: 'evt-1',
  org_id: 'org_mg',
  agent_id: 'agent-1',
  title: 'Llamada',
  event_type: 'llamada',
  start_at: '2026-04-15T10:00:00.000Z',
  end_at: '2026-04-15T10:30:00.000Z',
  all_day: 0,
  description: null,
  lead_id: null,
  contact_id: null,
  property_id: null,
  appraisal_id: null,
  reservation_id: null,
  color: null,
  completed: 0,
})

const mockCalendarRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}

describe('ToggleEventCompleteUseCase', () => {
  it('toggles event to completed', async () => {
    mockCalendarRepo.findById.mockResolvedValue(mockEvent)

    const useCase = new ToggleEventCompleteUseCase(mockCalendarRepo)
    const result = await useCase.execute('evt-1', 'org_mg')

    expect(result.completed).toBe(1)
    expect(mockCalendarRepo.save).toHaveBeenCalled()
  })

  it('throws NotFoundError when event not found', async () => {
    mockCalendarRepo.findById.mockResolvedValue(null)

    const useCase = new ToggleEventCompleteUseCase(mockCalendarRepo)
    await expect(useCase.execute('missing', 'org_mg'))
      .rejects.toThrow(NotFoundError)
  })
})
