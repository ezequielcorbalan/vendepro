import { describe, it, expect, vi } from 'vitest'
import { GetDashboardStatsUseCase } from '../../../src/application/use-cases/dashboard/get-dashboard-stats'

function lead(stage: string, created_at: string) {
  return { stage, created_at, getUrgency: () => 'normal' }
}

function makeRepos(leads: any[]) {
  const leadRepo = { findByOrg: vi.fn().mockResolvedValue(leads) } as any
  const propertyRepo = { findByOrg: vi.fn().mockResolvedValue([]) } as any
  const reservationRepo = { findByOrg: vi.fn().mockResolvedValue([]) } as any
  const calendarRepo = { findByOrg: vi.fn().mockResolvedValue([]) } as any
  return { leadRepo, propertyRepo, reservationRepo, calendarRepo }
}

describe('GetDashboardStatsUseCase — filtro de período (since)', () => {
  const leads = [
    lead('nuevo', '2026-01-10'),
    lead('nuevo', '2026-06-20'),
    lead('captado', '2026-06-25'),
    lead('contactado', '2026-06-28'),
  ]

  it('sin since computa el funnel sobre toda la historia', async () => {
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos(leads)
    const uc = new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
    const r = await uc.execute('org1')

    expect(r.totalLeads).toBe(4)
    expect(r.stageBreakdown['nuevo']).toBe(2)
    expect(r.stageBreakdown['captado']).toBe(1)
  })

  it('con since solo considera los leads creados desde esa fecha', async () => {
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos(leads)
    const uc = new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
    const r = await uc.execute('org1', undefined, '2026-06-01')

    // el lead de enero queda afuera
    expect(r.totalLeads).toBe(3)
    expect(r.stageBreakdown['nuevo']).toBe(1)
    expect(r.stageBreakdown['captado']).toBe(1)
    expect(r.stageBreakdown['contactado']).toBe(1)
  })
})
