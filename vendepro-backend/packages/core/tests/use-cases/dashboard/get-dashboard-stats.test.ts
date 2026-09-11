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

  it('KPIs/funnel piden solo el pipeline vendedor (compradores no contaminan)', async () => {
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos(leads)
    const uc = new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
    await uc.execute('org1')
    expect(leadRepo.findByOrg).toHaveBeenCalledWith('org1', expect.objectContaining({ pipeline: 'vendedor' }))

    await uc.execute('org1', 'agent-1')
    expect(leadRepo.findByOrg).toHaveBeenCalledWith('org1', expect.objectContaining({ pipeline: 'vendedor', agent_id: 'agent-1' }))
  })
})

describe('GetDashboardStatsUseCase — pipeline', () => {
  it('por defecto pide el pipeline vendedor', async () => {
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos([])
    await new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
      .execute('org1')

    expect(leadRepo.findByOrg).toHaveBeenCalledWith('org1', { pipeline: 'vendedor' })
  })

  it('acota los leads al pipeline pedido', async () => {
    // La pestaña de compradores tiene que preguntar por compradores. Sin esto
    // mostraba los leads de captación con etiquetas de comprador.
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos([])
    await new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
      .execute('org1', undefined, undefined, 'comprador')

    expect(leadRepo.findByOrg).toHaveBeenCalledWith('org1', { pipeline: 'comprador' })
  })

  it('el agente se combina con el pipeline, no lo reemplaza', async () => {
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos([])
    await new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
      .execute('org1', 'agente1', undefined, 'comprador')

    expect(leadRepo.findByOrg).toHaveBeenCalledWith('org1', {
      pipeline: 'comprador',
      agent_id: 'agente1',
    })
  })
})

describe('GetDashboardStatsUseCase — qué cuenta como lead activo', () => {
  function urgent(stage: string) {
    return { stage, created_at: '2026-01-01', getUrgency: () => 'danger' }
  }

  it('un lead inválido no está activo ni puede estar vencido', async () => {
    // Un teléfono falso o un duplicado es trabajo cerrado. Antes contaba como
    // activo y, si nadie lo tocaba en una semana, engrosaba la alerta de
    // "leads vencidos" — que es la alerta que uno mira para saber qué hacer.
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos([
      urgent('invalido'), urgent('contactado'),
    ])
    const r = await new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
      .execute('org1')

    expect(r.activeLeads).toBe(1)
    expect(r.urgentLeads).toBe(1)
  })

  it('un comprador cerrado tampoco está activo', async () => {
    const { leadRepo, propertyRepo, reservationRepo, calendarRepo } = makeRepos([
      urgent('cerrado'), urgent('oferta'),
    ])
    const r = await new GetDashboardStatsUseCase(leadRepo, propertyRepo, reservationRepo, calendarRepo)
      .execute('org1', undefined, undefined, 'comprador')

    expect(r.activeLeads).toBe(1)
  })
})
