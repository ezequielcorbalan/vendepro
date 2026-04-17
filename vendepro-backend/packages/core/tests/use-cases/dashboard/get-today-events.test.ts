import { describe, it, expect, vi } from 'vitest'
import { GetTodayEventsUseCase } from '../../../src/application/use-cases/dashboard/get-today-events'
import { CalendarEvent } from '../../../src/domain/entities/calendar-event'

function makeRepo() {
  return {
    findById: vi.fn(),
    findByOrg: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findByOrgAndDate: vi.fn(),
  }
}

function makeEvent(): CalendarEvent {
  return CalendarEvent.create({
    id: 'evt1',
    org_id: 'org1',
    agent_id: 'agent1',
    title: 'Test Event',
    event_type: 'llamada',
    start_at: new Date().toISOString(),
    end_at: new Date().toISOString(),
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
}

describe('GetTodayEventsUseCase', () => {
  it('returns events from repo for today', async () => {
    const repo = makeRepo()
    const evt = makeEvent()
    repo.findByOrgAndDate.mockResolvedValue([evt])

    const result = await new GetTodayEventsUseCase(repo).execute('org1')
    expect(result).toHaveLength(1)
    // called with today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]
    expect(repo.findByOrgAndDate).toHaveBeenCalledWith('org1', today)
  })

  it('returns empty array on repo error (graceful fallback)', async () => {
    const repo = makeRepo()
    repo.findByOrgAndDate.mockRejectedValue(new Error('table missing'))

    const result = await new GetTodayEventsUseCase(repo).execute('org1')
    expect(result).toEqual([])
  })

  it('returns empty array when no events today', async () => {
    const repo = makeRepo()
    repo.findByOrgAndDate.mockResolvedValue([])

    const result = await new GetTodayEventsUseCase(repo).execute('org1')
    expect(result).toEqual([])
  })
})
