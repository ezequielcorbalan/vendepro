import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProcessEmailQueueUseCase } from '../../../src/application/use-cases/email-campaigns/process-email-queue'
import { EmailCampaign } from '../../../src/domain/entities/email-campaign'
import { EmailSettings } from '../../../src/domain/entities/email-settings'

const signer = {
  sign: vi.fn(async (p: any) => `tok-${p.email}`),
  verify: vi.fn(),
}

const settings = EmailSettings.fromPersistence({
  org_id: 'org_mg', from_name: 'MG Inmobiliaria', from_email: 'hola@mg.com',
  reply_to: 'resp@mg.com', enabled: true, resend_domain_id: null, domain_status: 'verified',
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
})

function makeCampaign(over: any = {}) {
  return EmailCampaign.fromPersistence({
    id: 'camp_1', org_id: 'org_mg', name: 'Julio',
    subject: 'Hola {{nombre}}', preheader: null,
    html: '<html><body><p>Hola {{nombre}}</p></body></html>', text: 'Hola {{nombre}}',
    segment_json: JSON.stringify({ source: 'contacts' }),
    status: 'sending', scheduled_at: null,
    total_recipients: 2, sent_count: 0, failed_count: 0,
    created_by: 'u1', sent_at: null,
    created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
    ...over,
  })
}

const pendingRows = [
  { id: 's1', org_id: 'org_mg', campaign_id: 'camp_1', email: 'ana@x.com', name: 'Ana García', contact_id: 'c1', lead_id: null, status: 'pending' as const, attempts: 0, error: null, sent_at: null, opened_at: null, clicked_at: null, created_at: '' },
  { id: 's2', org_id: 'org_mg', campaign_id: 'camp_1', email: 'beto@x.com', name: null, contact_id: 'c2', lead_id: null, status: 'pending' as const, attempts: 0, error: null, sent_at: null, opened_at: null, clicked_at: null, created_at: '' },
]

function makeDeps({ campaign = makeCampaign(), pending = [pendingRows, []] as any[], sendBatchFails = false } = {}) {
  let call = 0
  const sendRepo = {
    listPending: vi.fn().mockImplementation(async () => pending[Math.min(call++, pending.length - 1)]),
    countPending: vi.fn().mockResolvedValue(0),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    listByCampaign: vi.fn().mockResolvedValue(pendingRows.map(r => ({ ...r, status: 'sent' }))),
    insertMany: vi.fn(),
    deleteByCampaign: vi.fn(),
  } as any
  const campaignRepo = {
    listByStatus: vi.fn().mockImplementation(async (status: string) =>
      status === 'sending' ? [campaign] : []),
    findById: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  } as any
  const emailService = {
    send: vi.fn().mockResolvedValue(undefined),
    sendBatch: sendBatchFails
      ? vi.fn().mockRejectedValue(new Error('Resend batch failed: 500'))
      : vi.fn().mockResolvedValue(undefined),
  } as any
  const settingsRepo = { findByOrg: vi.fn().mockResolvedValue(settings) } as any
  return { sendRepo, campaignRepo, emailService, settingsRepo }
}

describe('ProcessEmailQueueUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('manda el lote por sendBatch con personalización y footer de baja', async () => {
    const d = makeDeps()
    const uc = new ProcessEmailQueueUseCase(d.campaignRepo, d.sendRepo, d.settingsRepo, d.emailService, signer, 'https://vendepro.com.ar')
    const result = await uc.execute()

    expect(result.emails_sent).toBe(2)
    const batch = d.emailService.sendBatch.mock.calls[0][0]
    expect(batch).toHaveLength(2)
    // Personalización: {{nombre}} → primer nombre
    expect(batch[0].subject).toBe('Hola Ana')
    expect(batch[0].html).toContain('Hola Ana')
    // Sin nombre → variable vacía, no "undefined"
    expect(batch[1].subject).toBe('Hola ')
    // Footer de baja del template base, con el token propio de cada destinatario
    expect(batch[0].html).toContain('https://vendepro.com.ar/u/tok-ana@x.com')
    expect(batch[0].html).toContain('Cancelar suscripción')
    expect(batch[1].text).toContain('/u/tok-beto@x.com')
    // El HTML de la campaña ya era un documento completo: se re-enmarca en el
    // template base sin quedar un <html> adentro de otro.
    expect(batch[0].html).toMatch(/^<!DOCTYPE html>/)
    expect(batch[0].html.match(/<html/gi)).toHaveLength(1)
    expect(batch[0].html).toContain('Enviado con VendéPro')
    // Remitente y reply-to de la config
    expect(batch[0].from).toEqual({ email: 'hola@mg.com', name: 'MG Inmobiliaria' })
    expect(batch[0].replyTo).toBe('resp@mg.com')
    expect(batch[0].tags).toEqual({ kind: 'campaign', campaign_id: 'camp_1' })

    expect(d.sendRepo.markSent).toHaveBeenCalledWith(['s1', 's2'])
  })

  it('cierra la campaña como sent cuando no quedan pendientes', async () => {
    const d = makeDeps()
    const uc = new ProcessEmailQueueUseCase(d.campaignRepo, d.sendRepo, d.settingsRepo, d.emailService, signer, 'https://vendepro.com.ar')
    await uc.execute()

    const saved = d.campaignRepo.save.mock.calls.at(-1)![0]
    expect(saved.status).toBe('sent')
    expect(saved.sent_at).toBeTruthy()
    expect(saved.sent_count).toBe(2)
  })

  it('si el batch falla, marca las filas failed y no cierra con éxito silencioso', async () => {
    const d = makeDeps({ sendBatchFails: true })
    const uc = new ProcessEmailQueueUseCase(d.campaignRepo, d.sendRepo, d.settingsRepo, d.emailService, signer, 'https://vendepro.com.ar')
    const result = await uc.execute()

    expect(result.emails_failed).toBe(2)
    expect(d.sendRepo.markFailed).toHaveBeenCalledWith(['s1', 's2'], expect.stringMatching(/500/))
    expect(d.sendRepo.markSent).not.toHaveBeenCalled()
  })

  it('promueve campañas scheduled vencidas a sending', async () => {
    const scheduled = makeCampaign({ status: 'scheduled', scheduled_at: '2026-07-01T00:00:00.000Z' })
    const d = makeDeps({ campaign: scheduled })
    d.campaignRepo.listByStatus = vi.fn().mockImplementation(async (status: string) => {
      if (status === 'scheduled') return [scheduled]
      return [] // ya promovida en esta corrida; la procesa la próxima
    })
    const uc = new ProcessEmailQueueUseCase(d.campaignRepo, d.sendRepo, d.settingsRepo, d.emailService, signer, 'https://vendepro.com.ar')
    await uc.execute()

    expect(scheduled.status).toBe('sending')
    expect(d.campaignRepo.save).toHaveBeenCalled()
  })

  it('no envía si el remitente fue deshabilitado a mitad de campaña', async () => {
    const d = makeDeps()
    d.settingsRepo.findByOrg = vi.fn().mockResolvedValue(null)
    const uc = new ProcessEmailQueueUseCase(d.campaignRepo, d.sendRepo, d.settingsRepo, d.emailService, signer, 'https://vendepro.com.ar')
    const result = await uc.execute()

    expect(result.emails_sent).toBe(0)
    expect(d.emailService.sendBatch).not.toHaveBeenCalled()
  })
})
