import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProcessAutomationsUseCase } from '../../../src/application/use-cases/email-automations/process-automations'
import { EmailAutomation } from '../../../src/domain/entities/email-automation'
import { EmailSettings } from '../../../src/domain/entities/email-settings'

const idGen = (() => { let i = 0; return { generate: () => `snd_${++i}` } })()
const signer = { sign: vi.fn(async (p: any) => `tok-${p.email}`), verify: vi.fn() }

const settings = EmailSettings.fromPersistence({
  org_id: 'org_mg', from_name: 'MG', from_email: 'hola@mg.com', reply_to: null,
  enabled: true, resend_domain_id: null, domain_status: 'verified',
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
})

const steps = [
  { delay_hours: 0, subject: 'Hola {{nombre}}', preheader: '', html: '<body><p>Bienvenido {{nombre}}</p></body>', text: 'Bienvenido' },
  { delay_hours: 72, subject: 'Paso 2', preheader: '', html: '<body><p>Segundo</p></body>', text: 'Segundo' },
]

function makeAutomation(over: any = {}) {
  return EmailAutomation.fromPersistence({
    id: 'auto_1', org_id: 'org_mg', name: 'Bienvenida', status: 'active',
    trigger_event: 'lead_created', trigger_filter_json: null,
    steps_json: JSON.stringify(steps),
    created_by: 'u1', created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
    ...over,
  })
}

function enrollment(over: any = {}) {
  return {
    id: 'enr_1', org_id: 'org_mg', automation_id: 'auto_1',
    email: 'ana@x.com', name: 'Ana García', contact_id: null, lead_id: 'l1',
    current_step: 0, status: 'active', next_run_at: '2026-07-06T00:00:00.000Z',
    enrolled_at: '', created_at: '',
    ...over,
  }
}

function makeDeps({
  automation = makeAutomation(),
  due = [enrollment()],
  suppressed = null as any,
  sendFails = false,
  sett = settings as EmailSettings | null,
} = {}) {
  return {
    automationRepo: { findById: vi.fn().mockResolvedValue(automation), listActiveByTrigger: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() } as any,
    enrollmentRepo: {
      listDue: vi.fn().mockResolvedValue(due),
      advance: vi.fn().mockResolvedValue(undefined),
      finish: vi.fn().mockResolvedValue(undefined),
      insertMany: vi.fn(), listByAutomation: vi.fn(), countByStatus: vi.fn(), deleteByAutomation: vi.fn(),
    } as any,
    sendRepo: { record: vi.fn().mockResolvedValue(undefined), countByAutomation: vi.fn(), deleteByAutomation: vi.fn() } as any,
    settingsRepo: { findByOrg: vi.fn().mockResolvedValue(sett) } as any,
    suppressionRepo: { findByEmail: vi.fn().mockResolvedValue(suppressed) } as any,
    emailService: {
      send: sendFails ? vi.fn().mockRejectedValue(new Error('Resend send failed: 500')) : vi.fn().mockResolvedValue(undefined),
    } as any,
  }
}

function build(d: any) {
  return new ProcessAutomationsUseCase(
    d.automationRepo, d.enrollmentRepo, d.sendRepo, d.settingsRepo, d.suppressionRepo,
    d.emailService, signer, idGen, 'https://vendepro.com.ar',
  )
}

describe('ProcessAutomationsUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envía el paso actual personalizado y agenda el siguiente con su demora', async () => {
    const d = makeDeps()
    const result = await build(d).execute()

    expect(result.sent).toBe(1)
    const email = d.emailService.send.mock.calls[0][0]
    expect(email.subject).toBe('Hola Ana')
    expect(email.html).toContain('Bienvenido Ana')
    expect(email.html).toContain('https://vendepro.com.ar/u/tok-ana@x.com')
    expect(email.tags).toMatchObject({ kind: 'automation', automation_id: 'auto_1', step: '0' })

    // Agenda el paso 1 (delay 72h), no cierra la inscripción.
    expect(d.enrollmentRepo.advance).toHaveBeenCalledWith('enr_1', 1, expect.any(String))
    const nextRun = new Date(d.enrollmentRepo.advance.mock.calls[0][2]).getTime()
    expect(nextRun).toBeGreaterThan(Date.now() + 71 * 3600_000)
    expect(d.enrollmentRepo.finish).not.toHaveBeenCalled()
    expect(d.sendRepo.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', step_order: 0 }))
  })

  it('completa la inscripción tras el último paso', async () => {
    const d = makeDeps({ due: [enrollment({ current_step: 1 })] })
    await build(d).execute()
    expect(d.enrollmentRepo.finish).toHaveBeenCalledWith('enr_1', 'completed')
    expect(d.enrollmentRepo.advance).not.toHaveBeenCalled()
  })

  it('si el destinatario se dio de baja, cierra como unsubscribed sin enviar', async () => {
    const d = makeDeps({ suppressed: { email: 'ana@x.com' } })
    await build(d).execute()
    expect(d.emailService.send).not.toHaveBeenCalled()
    expect(d.enrollmentRepo.finish).toHaveBeenCalledWith('enr_1', 'unsubscribed')
  })

  it('automatización pausada → congela (no envía ni avanza)', async () => {
    const d = makeDeps({ automation: makeAutomation({ status: 'paused' }) })
    await build(d).execute()
    expect(d.emailService.send).not.toHaveBeenCalled()
    expect(d.enrollmentRepo.advance).not.toHaveBeenCalled()
    expect(d.enrollmentRepo.finish).not.toHaveBeenCalled()
  })

  it('sin remitente habilitado → congela', async () => {
    const d = makeDeps({ sett: null })
    await build(d).execute()
    expect(d.emailService.send).not.toHaveBeenCalled()
    expect(d.enrollmentRepo.advance).not.toHaveBeenCalled()
  })

  it('si el envío falla, registra failed pero igual avanza (no bloquea la secuencia)', async () => {
    const d = makeDeps({ sendFails: true })
    const result = await build(d).execute()
    expect(result.failed).toBe(1)
    expect(d.sendRepo.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: expect.stringMatching(/500/) }))
    expect(d.enrollmentRepo.advance).toHaveBeenCalledWith('enr_1', 1, expect.any(String))
  })
})
