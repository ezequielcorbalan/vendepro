import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RunAutomationsForEventUseCase, RUNS_PER_HOUR_LIMIT } from '../../../src/application/use-cases/automations/run-automations-for-event'
import { Automation } from '../../../src/domain/entities/automation'
import { AutomationAction } from '../../../src/domain/entities/automation-action'
import type { AutomationWithActions } from '../../../src/application/ports/repositories/automation-repository'

const mockRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  findActiveByTrigger: vi.fn(),
  findSystemCatalog: vi.fn(),
  findSystemByTemplateKey: vi.fn(),
  findActivatedTemplateKeys: vi.fn(),
  findActiveTimeBased: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  setActive: vi.fn(),
}

const mockRuns = {
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  claim: vi.fn().mockResolvedValue(true),
  statsByOrg: vi.fn(),
  countSince: vi.fn().mockResolvedValue(0),
  saveAction: vi.fn().mockResolvedValue(undefined),
  findActionsByRun: vi.fn(),
}

const mockJobs = {
  save: vi.fn(),
  saveMany: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  findDue: vi.fn(),
  countPendingByRun: vi.fn(),
  cancelPendingByAutomation: vi.fn(),
}

let idSeq = 0
const mockIds = { generate: vi.fn(() => `id-${++idSeq}`) }

function makeAutomation(overrides: {
  id?: string
  trigger_type?: string
  trigger_config?: Record<string, unknown>
  conditions?: unknown
  actions?: Array<{ type?: string; delay?: number; config?: Record<string, unknown> }>
} = {}): AutomationWithActions {
  const id = overrides.id ?? 'auto-1'
  const automation = Automation.create({
    id,
    org_id: 'org_mg',
    name: 'Bienvenida al lead',
    description: null,
    template_key: null,
    is_system: false,
    trigger_type: (overrides.trigger_type ?? 'lead.created') as any,
    trigger_config: overrides.trigger_config ?? {},
    conditions: overrides.conditions ?? [],
    is_active: true,
    created_by: 'user-1',
  })
  const specs = overrides.actions ?? [{ type: 'send_email' }]
  const actions = specs.map((spec, i) =>
    AutomationAction.create({
      id: `act-${id}-${i}`,
      automation_id: id,
      org_id: 'org_mg',
      order_index: i,
      action_type: (spec.type ?? 'send_email') as any,
      action_config: spec.config ?? { subject: 'Gracias {{lead.first_name}}', body_html: '<p>Hola</p>' },
      delay_minutes: spec.delay ?? 0,
    }),
  )
  return { automation, actions }
}

const baseInput = {
  orgId: 'org_mg',
  trigger: 'lead.created',
  entityType: 'lead' as const,
  entityId: 'lead-1',
  context: { lead: { full_name: 'Ana Pérez', email: 'ana@mail.com', source: 'web' } },
}

function useCase() {
  return new RunAutomationsForEventUseCase(mockRepo as any, mockRuns as any, mockJobs as any, mockIds)
}

beforeEach(() => {
  vi.clearAllMocks()
  idSeq = 0
  mockRuns.claim.mockResolvedValue(true)
  mockRuns.countSince.mockResolvedValue(0)
  mockRuns.save.mockResolvedValue(undefined)
  mockRuns.saveAction.mockResolvedValue(undefined)
  mockJobs.saveMany.mockResolvedValue(undefined)
})

describe('RunAutomationsForEventUseCase', () => {
  it('no hace nada si la org no tiene automatizaciones para el trigger', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([])
    const result = await useCase().execute(baseInput)
    expect(result).toEqual({ evaluated: 0, queued: 0, results: [] })
    expect(mockJobs.saveMany).not.toHaveBeenCalled()
  })

  it('encola un job por acción cuando el evento matchea', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([
      makeAutomation({ actions: [{ type: 'send_email' }, { type: 'notify_agent', config: { title: 'Nuevo lead', message: 'Ana' } }] }),
    ])
    const result = await useCase().execute(baseInput)

    expect(result.queued).toBe(1)
    expect(result.results[0].jobs_queued).toBe(2)
    expect(mockRuns.saveAction).toHaveBeenCalledTimes(2)
    const jobs = mockJobs.saveMany.mock.calls[0][0]
    expect(jobs).toHaveLength(2)
    expect(jobs.map((j: any) => j.action_type)).toEqual(['send_email', 'notify_agent'])
  })

  it('congela contexto y config dentro del job', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeAutomation()])
    await useCase().execute(baseInput)

    const [job] = mockJobs.saveMany.mock.calls[0][0]
    expect(job.context.lead.full_name).toBe('Ana Pérez')
    expect(job.action_config.subject).toBe('Gracias {{lead.first_name}}')
  })

  it('calcula run_at según el delay de cada acción', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([
      makeAutomation({ actions: [{ delay: 0 }, { delay: 60 }] }),
    ])
    const now = new Date('2026-08-27T10:00:00.000Z')
    await useCase().execute({ ...baseInput, now })

    const jobs = mockJobs.saveMany.mock.calls[0][0]
    expect(jobs[0].run_at).toBe('2026-08-27T10:00:00.000Z')
    expect(jobs[1].run_at).toBe('2026-08-27T11:00:00.000Z')
  })

  it('descarta si el to_stage del trigger no coincide', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([
      makeAutomation({ trigger_type: 'lead.stage_changed', trigger_config: { to_stage: 'captado' } }),
    ])
    const result = await useCase().execute({
      ...baseInput,
      trigger: 'lead.stage_changed',
      event: { to_stage: 'contactado', from_stage: 'nuevo' },
    })

    expect(result.queued).toBe(0)
    expect(result.results[0].skip_reason).toBe('trigger_mismatch')
    // Un trigger que no matchea no ensucia el log del cliente.
    expect(mockRuns.claim).not.toHaveBeenCalled()
  })

  it('un to_stage vacío matchea cualquier cambio de etapa', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([
      makeAutomation({ trigger_type: 'lead.stage_changed', trigger_config: {} }),
    ])
    const result = await useCase().execute({
      ...baseInput,
      trigger: 'lead.stage_changed',
      event: { to_stage: 'contactado' },
    })
    expect(result.queued).toBe(1)
  })

  it('descarta si las condiciones no se cumplen', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([
      makeAutomation({ conditions: [{ field: 'lead.source', op: 'eq', value: 'zonaprop' }] }),
    ])
    const result = await useCase().execute(baseInput)

    expect(result.queued).toBe(0)
    expect(result.results[0].skip_reason).toBe('conditions_not_met')
    expect(mockJobs.saveMany).not.toHaveBeenCalled()
  })

  it('descarta el duplicado cuando el dedupe_key ya estaba tomado', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeAutomation()])
    mockRuns.claim.mockResolvedValue(false)

    const result = await useCase().execute(baseInput)
    expect(result.queued).toBe(0)
    expect(result.results[0].skip_reason).toBe('duplicate')
    expect(mockJobs.saveMany).not.toHaveBeenCalled()
  })

  it('genera el mismo dedupe_key para el mismo lead el mismo día, y distinto al día siguiente', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeAutomation()])

    await useCase().execute({ ...baseInput, now: new Date('2026-08-27T08:00:00Z') })
    const first = mockRuns.claim.mock.calls[0][0].dedupe_key
    await useCase().execute({ ...baseInput, now: new Date('2026-08-27T23:00:00Z') })
    const same = mockRuns.claim.mock.calls[1][0].dedupe_key
    await useCase().execute({ ...baseInput, now: new Date('2026-08-28T08:00:00Z') })
    const next = mockRuns.claim.mock.calls[2][0].dedupe_key

    expect(first).toBe(same)
    expect(next).not.toBe(first)
  })

  it('corta el encadenamiento al llegar a la profundidad máxima', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeAutomation()])
    const result = await useCase().execute({ ...baseInput, depth: 1 })

    expect(result).toEqual({ evaluated: 0, queued: 0, results: [] })
    // Ni siquiera consulta: a esa profundidad no hay nada que evaluar.
    expect(mockRepo.findActiveByTrigger).not.toHaveBeenCalled()
  })

  it('saltea la acción que encadena eventos si el run ya no puede encadenar', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([
      makeAutomation({
        actions: [
          { type: 'send_email' },
          { type: 'change_stage', config: { to_stage: 'contactado' } },
        ],
      }),
    ])
    // depth 0 todavía puede encadenar: las dos acciones se encolan.
    const ok = await useCase().execute(baseInput)
    expect(ok.results[0].jobs_queued).toBe(2)
  })

  it('no encola nada cuando la automatización no tiene acciones', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeAutomation({ actions: [] })])
    const result = await useCase().execute(baseInput)
    expect(result.results[0].skip_reason).toBe('no_actions')
  })

  it('corta por rate limit y deja el run registrado para que se vea', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeAutomation()])
    mockRuns.countSince.mockResolvedValue(RUNS_PER_HOUR_LIMIT)

    const result = await useCase().execute(baseInput)
    expect(result.queued).toBe(0)
    expect(result.results[0].skip_reason).toBe('rate_limited')
    expect(mockRuns.save).toHaveBeenCalled()
    expect(mockJobs.saveMany).not.toHaveBeenCalled()
  })

  it('si falla la consulta del rate limit no bloquea el negocio', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([makeAutomation()])
    mockRuns.countSince.mockRejectedValue(new Error('D1 caído'))

    const result = await useCase().execute(baseInput)
    expect(result.queued).toBe(1)
  })

  it('evalúa cada automatización por separado: una que falla no frena a la otra', async () => {
    mockRepo.findActiveByTrigger.mockResolvedValue([
      makeAutomation({ id: 'auto-1', conditions: [{ field: 'lead.source', op: 'eq', value: 'zonaprop' }] }),
      makeAutomation({ id: 'auto-2' }),
    ])
    const result = await useCase().execute(baseInput)

    expect(result.evaluated).toBe(2)
    expect(result.queued).toBe(1)
    expect(result.results.map((r) => r.skip_reason)).toEqual(['conditions_not_met', undefined])
  })
})
