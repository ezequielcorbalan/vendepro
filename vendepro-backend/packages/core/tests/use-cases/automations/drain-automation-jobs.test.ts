import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DrainAutomationJobsUseCase,
  interpolateConfig,
} from '../../../src/application/use-cases/automations/drain-automation-jobs'
import { AutomationJob, MAX_JOB_ATTEMPTS } from '../../../src/domain/entities/automation-job'
import { AutomationRun, AutomationRunAction } from '../../../src/domain/entities/automation-run'

const mockJobs = {
  save: vi.fn().mockResolvedValue(undefined),
  saveMany: vi.fn(),
  findById: vi.fn(),
  findDue: vi.fn().mockResolvedValue([]),
  countPendingByRun: vi.fn().mockResolvedValue(0),
  cancelPendingByAutomation: vi.fn(),
}

const mockRuns = {
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  claim: vi.fn(),
  statsByOrg: vi.fn(),
  countSince: vi.fn(),
  saveAction: vi.fn().mockResolvedValue(undefined),
  findActionsByRun: vi.fn(),
}

function makeJob(overrides: Partial<Parameters<typeof AutomationJob.create>[0]> = {}) {
  return AutomationJob.create({
    id: 'job-1',
    org_id: 'org_mg',
    run_id: 'run-1',
    run_action_id: 'ra-1',
    automation_id: 'auto-1',
    action_id: 'act-1',
    action_type: 'send_email',
    context: { lead: { full_name: 'Ana Pérez', email: 'ana@mail.com' } },
    action_config: { subject: 'Hola {{lead.first_name}}', body_html: '<p>Hola {{lead.full_name}}</p>' },
    run_at: '2026-08-27T10:00:00.000Z',
    ...overrides,
  })
}

function makeRunAction(status: 'pending' = 'pending') {
  return AutomationRunAction.create({
    id: 'ra-1',
    run_id: 'run-1',
    org_id: 'org_mg',
    action_id: 'act-1',
    action_type: 'send_email',
    status,
  })
}

function registry(executor: { type: string; execute: any } | null) {
  return { get: vi.fn(() => executor) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockJobs.save.mockResolvedValue(undefined)
  mockJobs.findDue.mockResolvedValue([])
  mockJobs.countPendingByRun.mockResolvedValue(0)
  mockRuns.save.mockResolvedValue(undefined)
  mockRuns.saveAction.mockResolvedValue(undefined)
  mockRuns.findById.mockResolvedValue(null)
})

describe('DrainAutomationJobsUseCase', () => {
  it('sin jobs vencidos no hace nada', async () => {
    const uc = new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry(null) as any)
    expect(await uc.execute()).toEqual({ processed: 0, succeeded: 0, failed: 0, skipped: 0 })
  })

  it('ejecuta la acción con la config ya interpolada y cierra el job', async () => {
    const job = makeJob()
    const runAction = makeRunAction()
    mockJobs.findDue.mockResolvedValue([job])
    mockRuns.findActionsByRun.mockResolvedValue([runAction])

    const execute = vi.fn().mockResolvedValue({ status: 'success', result: { to: 'ana@mail.com' } })
    const uc = new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry({ type: 'send_email', execute }) as any)
    const out = await uc.execute()

    expect(out).toEqual({ processed: 1, succeeded: 1, failed: 0, skipped: 0 })
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org_mg',
        config: { subject: 'Hola Ana', body_html: '<p>Hola Ana Pérez</p>' },
      }),
    )
    expect(job.status).toBe('done')
    expect(runAction.status).toBe('success')
    expect(runAction.result).toEqual({ to: 'ana@mail.com' })
  })

  it('toma el lease antes de ejecutar, para que dos drenajes no dupliquen el envío', async () => {
    const job = makeJob()
    mockJobs.findDue.mockResolvedValue([job])
    mockRuns.findActionsByRun.mockResolvedValue([makeRunAction()])

    const statusAtExecution: string[] = []
    const execute = vi.fn(async () => {
      statusAtExecution.push(job.status)
      return { status: 'success' as const }
    })
    await new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry({ type: 'send_email', execute }) as any).execute()

    expect(statusAtExecution).toEqual(['running'])
    // El primer save persiste el lease, antes de cualquier efecto.
    expect(mockJobs.save.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('marca skipped sin reintento cuando la acción no tiene ejecutor', async () => {
    const job = makeJob({ action_type: 'send_webhook' })
    const runAction = makeRunAction()
    mockJobs.findDue.mockResolvedValue([job])
    mockRuns.findActionsByRun.mockResolvedValue([runAction])

    const out = await new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry(null) as any).execute()

    expect(out.skipped).toBe(1)
    expect(job.status).toBe('done')
    expect(runAction.status).toBe('skipped')
    expect(runAction.error).toBe('not_implemented')
  })

  it('un skip del ejecutor (contacto dado de baja) no es un fallo', async () => {
    const job = makeJob()
    const runAction = makeRunAction()
    mockJobs.findDue.mockResolvedValue([job])
    mockRuns.findActionsByRun.mockResolvedValue([runAction])

    const execute = vi.fn().mockResolvedValue({ status: 'skipped', reason: 'suppressed' })
    const out = await new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry({ type: 'send_email', execute }) as any).execute()

    expect(out).toEqual({ processed: 1, succeeded: 0, failed: 0, skipped: 1 })
    expect(job.status).toBe('done')
    expect(runAction.status).toBe('skipped')
  })

  it('reprograma con backoff mientras queden intentos', async () => {
    const job = makeJob()
    const runAction = makeRunAction()
    mockJobs.findDue.mockResolvedValue([job])
    mockRuns.findActionsByRun.mockResolvedValue([runAction])

    const execute = vi.fn().mockRejectedValue(new Error('Resend 503'))
    const now = new Date('2026-08-27T10:00:00.000Z')
    const out = await new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry({ type: 'send_email', execute }) as any).execute({ now })

    expect(out.failed).toBe(1)
    expect(job.status).toBe('pending')
    expect(job.attempts).toBe(1)
    expect(job.run_at).toBe('2026-08-27T10:05:00.000Z')
    expect(job.last_error).toBe('Resend 503')
    // La acción sigue pendiente: todavía puede salir bien en el reintento.
    expect(runAction.status).toBe('pending')
  })

  it('al agotar los intentos deja el job failed y marca la acción como fallida', async () => {
    const job = makeJob({ attempts: MAX_JOB_ATTEMPTS - 1 })
    const runAction = makeRunAction()
    mockJobs.findDue.mockResolvedValue([job])
    mockRuns.findActionsByRun.mockResolvedValue([runAction])

    const execute = vi.fn().mockRejectedValue(new Error('Resend 503'))
    await new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry({ type: 'send_email', execute }) as any).execute()

    expect(job.status).toBe('failed')
    expect(runAction.status).toBe('failed')
    expect(runAction.error).toBe('Resend 503')
  })

  it('cierra el run cuando ya no le quedan jobs pendientes', async () => {
    const job = makeJob()
    const runAction = makeRunAction()
    const run = AutomationRun.create({
      id: 'run-1',
      org_id: 'org_mg',
      automation_id: 'auto-1',
      trigger_event: 'lead.created',
      entity_type: 'lead',
      entity_id: 'lead-1',
      payload: null,
      depth: 0,
      dedupe_key: 'k',
    })
    mockJobs.findDue.mockResolvedValue([job])
    mockJobs.countPendingByRun.mockResolvedValue(0)
    mockRuns.findActionsByRun.mockResolvedValue([runAction])
    mockRuns.findById.mockResolvedValue(run)

    const execute = vi.fn().mockResolvedValue({ status: 'success' })
    await new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry({ type: 'send_email', execute }) as any).execute()

    expect(run.status).toBe('success')
    expect(run.finished_at).not.toBeNull()
    expect(mockRuns.save).toHaveBeenCalled()
  })

  it('deja el run abierto mientras le queden jobs diferidos', async () => {
    const job = makeJob()
    mockJobs.findDue.mockResolvedValue([job])
    mockJobs.countPendingByRun.mockResolvedValue(1)
    mockRuns.findActionsByRun.mockResolvedValue([makeRunAction()])

    const execute = vi.fn().mockResolvedValue({ status: 'success' })
    await new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry({ type: 'send_email', execute }) as any).execute()

    expect(mockRuns.findById).not.toHaveBeenCalled()
    expect(mockRuns.save).not.toHaveBeenCalled()
  })

  it('un job que explota no frena a los siguientes de la pasada', async () => {
    const bad = makeJob({ id: 'job-bad' })
    const good = makeJob({ id: 'job-good', run_id: 'run-2', run_action_id: 'ra-2' })
    mockJobs.findDue.mockResolvedValue([bad, good])
    mockRuns.findActionsByRun.mockResolvedValue([makeRunAction()])

    const execute = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ status: 'success' })
    const out = await new DrainAutomationJobsUseCase(mockJobs as any, mockRuns as any, registry({ type: 'send_email', execute }) as any).execute()

    expect(out).toEqual({ processed: 2, succeeded: 1, failed: 1, skipped: 0 })
  })
})

describe('interpolateConfig', () => {
  const ctx = { lead: { full_name: 'Ana & Cía', email: 'ana@mail.com' } }

  it('escapa sólo en los campos *_html', () => {
    const out = interpolateConfig(
      { subject: 'Hola {{lead.full_name}}', body_html: '<p>{{lead.full_name}}</p>' },
      ctx,
    )
    expect(out.subject).toBe('Hola Ana & Cía')
    expect(out.body_html).toBe('<p>Ana &amp; Cía</p>')
  })

  it('interpola dentro de arrays y deja los no-strings intactos', () => {
    const out = interpolateConfig(
      { tags: ['{{lead.email}}', 'fijo'], include_unsubscribe: true, due_in_days: 7 },
      ctx,
    )
    expect(out.tags).toEqual(['ana@mail.com', 'fijo'])
    expect(out.include_unsubscribe).toBe(true)
    expect(out.due_in_days).toBe(7)
  })
})
