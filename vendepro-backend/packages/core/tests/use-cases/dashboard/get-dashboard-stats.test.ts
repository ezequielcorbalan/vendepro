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

  it('sin since: funnel = toda la historia (igual que el pipeline)', async () => {
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos(leads)
    const uc = new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
    const r = await uc.execute('org1')

    expect(r.totalLeads).toBe(4)
    expect(r.stageBreakdown['nuevo']).toBe(2)
    expect(r.funnelTotalLeads).toBe(4)
    expect(r.funnelStageBreakdown['nuevo']).toBe(2)
  })

  it('con since: el pipeline (stageBreakdown) NO se acota, solo el funnel', async () => {
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos(leads)
    const uc = new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
    const r = await uc.execute('org1', undefined, '2026-06-01')

    // Pipeline / KPIs: toda la historia
    expect(r.totalLeads).toBe(4)
    expect(r.stageBreakdown['nuevo']).toBe(2)
    // Funnel: solo el período (el lead de enero queda afuera)
    expect(r.funnelTotalLeads).toBe(3)
    expect(r.funnelStageBreakdown['nuevo']).toBe(1)
    expect(r.funnelStageBreakdown['captado']).toBe(1)
    expect(r.funnelStageBreakdown['contactado']).toBe(1)
  })
})
