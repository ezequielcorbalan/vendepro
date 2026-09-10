import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateLeadUseCase } from '../../../src/application/use-cases/leads/update-lead'
import { Lead } from '../../../src/domain/entities/lead'

const repo = { findById: vi.fn(), save: vi.fn().mockResolvedValue(undefined) }

function makeLead(assignedTo: string | null) {
  return Lead.create({
    id: 'lead-1',
    org_id: 'org_mg',
    full_name: 'Ana Pérez',
    phone: '11 5555-5555',
    email: null,
    source: 'manual',
    stage: 'nuevo',
    assigned_to: assignedTo,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  repo.save.mockResolvedValue(undefined)
})

describe('UpdateLeadUseCase — detección de reasignación', () => {
  it('reporta assignedChanged cuando cambia el agente responsable', async () => {
    repo.findById.mockResolvedValue(makeLead('agent-1'))

    const out = await new UpdateLeadUseCase(repo as any).execute({
      id: 'lead-1', orgId: 'org_mg', assigned_to: 'agent-2',
    })

    expect(out).toEqual({ assignedChanged: true, assignedTo: 'agent-2' })
  })

  it('asignar un lead que no tenía agente también cuenta como cambio', async () => {
    repo.findById.mockResolvedValue(makeLead(null))

    const out = await new UpdateLeadUseCase(repo as any).execute({
      id: 'lead-1', orgId: 'org_mg', assigned_to: 'agent-1',
    })

    expect(out.assignedChanged).toBe(true)
  })

  it('re-mandar el mismo agente no dispara nada', async () => {
    repo.findById.mockResolvedValue(makeLead('agent-1'))

    const out = await new UpdateLeadUseCase(repo as any).execute({
      id: 'lead-1', orgId: 'org_mg', assigned_to: 'agent-1',
    })

    expect(out.assignedChanged).toBe(false)
  })

  it('un update sin assigned_to nunca cuenta como reasignación', async () => {
    repo.findById.mockResolvedValue(makeLead('agent-1'))

    const out = await new UpdateLeadUseCase(repo as any).execute({
      id: 'lead-1', orgId: 'org_mg', notes: 'nueva nota',
    })

    expect(out.assignedChanged).toBe(false)
    expect(out.assignedTo).toBe('agent-1')
  })
})
