import { describe, it, expect, vi } from 'vitest'
import { GetTeamStatsUseCase } from '../../../src/application/use-cases/dashboard/get-team-stats'
import { Lead } from '../../../src/domain/entities/lead'
import { User } from '../../../src/domain/entities/user'

function makeUser(id: string, fullName: string, role = 'agent') {
  return User.create({
    id,
    org_id: 'org1',
    email: `${id}@test.com`,
    password_hash: 'x',
    full_name: fullName,
    role: role as any,
    active: 1,
    phone: null,
    photo_url: null,
  })
}

function makeLead(id: string, assignedTo: string | null, stage: string) {
  return Lead.create({
    id,
    org_id: 'org1',
    contact_id: 'c1',
    full_name: `Lead ${id}`,
    phone: null,
    email: null,
    source: 'manual',
    source_detail: null,
    stage: stage as any,
    pipeline: 'vendedor',
    operation: 'venta',
    property_address: null,
    neighborhood: null,
    estimated_value: null,
    budget: null,
    notes: null,
    next_step: null,
    next_step_date: null,
    assigned_to: assignedTo,
  })
}

function makeRepos(users: User[], leads: Lead[], activity: Record<string, number>) {
  return {
    users: {
      findById: vi.fn(), findByEmail: vi.fn(),
      findByOrg: vi.fn().mockResolvedValue(users),
      findDeletedByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(), restore: vi.fn(),
      updateRole: vi.fn(), findFirstAdminByOrg: vi.fn(), findProfileById: vi.fn(),
      updateProfile: vi.fn(),
    },
    leads: {
      findById: vi.fn(),
      findByOrg: vi.fn().mockResolvedValue(leads),
      save: vi.fn(), delete: vi.fn(), searchByName: vi.fn(),
      findPendingFollowups: vi.fn(), exportAllWithAssignedName: vi.fn(),
    },
    activities: {
      findByOrg: vi.fn(), findById: vi.fn(), save: vi.fn(), delete: vi.fn(),
      findByOrgSince: vi.fn(), findLatestByOrg: vi.fn(), aggregateByTypeSince: vi.fn(),
      findByCalendarEventId: vi.fn(), deleteByCalendarEventId: vi.fn(),
      countByAgentSince: vi.fn().mockResolvedValue(activity),
    },
  }
}

describe('GetTeamStatsUseCase', () => {
  it('calcula leads, captados y conversión por agente', async () => {
    const repos = makeRepos(
      [makeUser('a1', 'Marcela Genta'), makeUser('a2', 'Felix Romero')],
      [
        makeLead('l1', 'a1', 'captado'),
        makeLead('l2', 'a1', 'contactado'),
        makeLead('l3', 'a1', 'nuevo'),
        makeLead('l4', 'a1', 'captado'),
        makeLead('l5', 'a2', 'contactado'),
      ],
      { a1: 12, a2: 3 },
    )

    const result = await new GetTeamStatsUseCase(repos.users, repos.leads, repos.activities)
      .execute('org1')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'a1',
      full_name: 'Marcela Genta',
      role: 'agent',
      total_leads: 4,
      captados: 2,
      conversion: 50,
      actividad_mes: 12,
    })
    expect(result[1]?.conversion).toBe(0)
  })

  it('pide sólo el pipeline vendedor: la meta de captación es "captado"', async () => {
    const repos = makeRepos([makeUser('a1', 'Marcela')], [], {})

    await new GetTeamStatsUseCase(repos.users, repos.leads, repos.activities).execute('org1')

    expect(repos.leads.findByOrg).toHaveBeenCalledWith('org1', { pipeline: 'vendedor' })
  })

  it('ordena por captados y desempata por leads', async () => {
    const repos = makeRepos(
      [makeUser('a1', 'Primero'), makeUser('a2', 'Segundo'), makeUser('a3', 'Tercero')],
      [
        makeLead('l1', 'a1', 'contactado'),
        makeLead('l2', 'a2', 'captado'),
        makeLead('l3', 'a3', 'captado'),
        makeLead('l4', 'a3', 'nuevo'),
      ],
      {},
    )

    const result = await new GetTeamStatsUseCase(repos.users, repos.leads, repos.activities)
      .execute('org1')

    expect(result.map(a => a.id)).toEqual(['a3', 'a2', 'a1'])
  })

  it('deja fuera a los usuarios sin leads ni actividad', async () => {
    const repos = makeRepos(
      [makeUser('a1', 'Comercial'), makeUser('admin1', 'Administrativa', 'admin')],
      [makeLead('l1', 'a1', 'nuevo')],
      {},
    )

    const result = await new GetTeamStatsUseCase(repos.users, repos.leads, repos.activities)
      .execute('org1')

    expect(result.map(a => a.id)).toEqual(['a1'])
  })

  it('ignora los leads sin agente asignado', async () => {
    const repos = makeRepos(
      [makeUser('a1', 'Comercial')],
      [makeLead('l1', null, 'captado'), makeLead('l2', 'a1', 'captado')],
      {},
    )

    const result = await new GetTeamStatsUseCase(repos.users, repos.leads, repos.activities)
      .execute('org1')

    expect(result[0]?.total_leads).toBe(1)
  })
})
