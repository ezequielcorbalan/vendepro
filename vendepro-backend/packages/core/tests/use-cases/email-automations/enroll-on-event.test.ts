import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnrollOnEventUseCase } from '../../../src/application/use-cases/email-automations/enroll-on-event'
import { EmailAutomation } from '../../../src/domain/entities/email-automation'

const idGen = (() => { let i = 0; return { generate: () => `enr_${++i}` } })()

function makeAutomation(over: any = {}) {
  return EmailAutomation.fromPersistence({
    id: 'auto_1', org_id: 'org_mg', name: 'Bienvenida', status: 'active',
    trigger_event: 'lead_created', trigger_filter_json: null,
    steps_json: JSON.stringify([{ delay_hours: 0, subject: 'Hi', preheader: '', html: '<p>x</p>', text: 'x' }]),
    created_by: 'u1', created_at: '', updated_at: '', ...over,
  })
}

function makeDeps(automations: EmailAutomation[]) {
  return {
    automationRepo: { listActiveByTrigger: vi.fn().mockResolvedValue(automations), findById: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() } as any,
    enrollmentRepo: { insertMany: vi.fn().mockResolvedValue(undefined), listDue: vi.fn(), advance: vi.fn(), finish: vi.fn(), listByAutomation: vi.fn(), countByStatus: vi.fn(), deleteByAutomation: vi.fn() } as any,
  }
}

describe('EnrollOnEventUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inscribe el destinatario en las automatizaciones activas de su org', async () => {
    const d = makeDeps([makeAutomation()])
    const uc = new EnrollOnEventUseCase(d.automationRepo, d.enrollmentRepo, idGen)
    const result = await uc.execute({
      orgId: 'org_mg', event: 'lead_created',
      recipient: { email: 'Nuevo@Lead.com', name: 'Nuevo', lead_id: 'l1' },
    })

    expect(result.enrolled_in).toBe(1)
    const row = d.enrollmentRepo.insertMany.mock.calls[0][0][0]
    expect(row).toMatchObject({ automation_id: 'auto_1', email: 'nuevo@lead.com', lead_id: 'l1' })
    expect(row.next_run_at).toBeTruthy()
  })

  it('ignora automatizaciones de otra org', async () => {
    const d = makeDeps([makeAutomation({ org_id: 'otra_org' })])
    const uc = new EnrollOnEventUseCase(d.automationRepo, d.enrollmentRepo, idGen)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead_created', recipient: { email: 'a@b.com' } })
    expect(result.enrolled_in).toBe(0)
    expect(d.enrollmentRepo.insertMany).not.toHaveBeenCalled()
  })

  it('ignora automatizaciones sin pasos', async () => {
    const d = makeDeps([makeAutomation({ steps_json: null })])
    const uc = new EnrollOnEventUseCase(d.automationRepo, d.enrollmentRepo, idGen)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead_created', recipient: { email: 'a@b.com' } })
    expect(result.enrolled_in).toBe(0)
  })

  it('sin email válido no inscribe', async () => {
    const d = makeDeps([makeAutomation()])
    const uc = new EnrollOnEventUseCase(d.automationRepo, d.enrollmentRepo, idGen)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead_created', recipient: { email: '' } })
    expect(result.enrolled_in).toBe(0)
    expect(d.automationRepo.listActiveByTrigger).not.toHaveBeenCalled()
  })
})
