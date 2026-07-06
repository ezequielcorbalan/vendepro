import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueueCampaignSendUseCase } from '../../../src/application/use-cases/email-campaigns/queue-campaign-send'
import { EmailCampaign } from '../../../src/domain/entities/email-campaign'
import { EmailSettings } from '../../../src/domain/entities/email-settings'

const idGen = (() => { let i = 0; return { generate: () => `id_${++i}` } })()

function makeCampaign(over: any = {}) {
  return EmailCampaign.fromPersistence({
    id: 'camp_1', org_id: 'org_mg', name: 'Novedades julio',
    subject: 'Nuevas propiedades', preheader: null,
    html: '<p>Hola {{nombre}}</p>', text: 'Hola',
    segment_json: JSON.stringify({ source: 'contacts', contact_type: 'comprador' }),
    status: 'draft', scheduled_at: null,
    total_recipients: 0, sent_count: 0, failed_count: 0,
    created_by: 'u1', sent_at: null,
    created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
    ...over,
  })
}

const readySettings = EmailSettings.fromPersistence({
  org_id: 'org_mg', from_name: 'MG', from_email: 'hola@mg.com', reply_to: null,
  enabled: true, resend_domain_id: null, domain_status: 'verified',
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
})

function makeDeps({ campaign = makeCampaign(), settings = readySettings as EmailSettings | null, recipients = [
  { email: 'a@x.com', name: 'Ana', contact_id: 'c1', lead_id: null },
  { email: 'b@x.com', name: 'Beto', contact_id: 'c2', lead_id: null },
] } = {}) {
  return {
    campaignRepo: {
      findById: vi.fn().mockResolvedValue(campaign),
      save: vi.fn().mockResolvedValue(undefined),
    } as any,
    sendRepo: { insertMany: vi.fn().mockResolvedValue(undefined) } as any,
    audienceRepo: { resolve: vi.fn().mockResolvedValue(recipients) } as any,
    settingsRepo: { findByOrg: vi.fn().mockResolvedValue(settings) } as any,
  }
}

describe('QueueCampaignSendUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('congela la audiencia y pasa a sending para envío inmediato', async () => {
    const d = makeDeps()
    const uc = new QueueCampaignSendUseCase(d.campaignRepo, d.sendRepo, d.audienceRepo, d.settingsRepo, idGen)
    const result = await uc.execute({ campaignId: 'camp_1', orgId: 'org_mg' })

    expect(result).toMatchObject({ ok: true, total_recipients: 2, status: 'sending' })
    const rows = d.sendRepo.insertMany.mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ campaign_id: 'camp_1', email: 'a@x.com', org_id: 'org_mg' })
    const saved = d.campaignRepo.save.mock.calls[0][0]
    expect(saved.status).toBe('sending')
    expect(saved.total_recipients).toBe(2)
  })

  it('con scheduled_at futuro queda scheduled', async () => {
    const d = makeDeps()
    const uc = new QueueCampaignSendUseCase(d.campaignRepo, d.sendRepo, d.audienceRepo, d.settingsRepo, idGen)
    const future = new Date(Date.now() + 3600_000).toISOString()
    const result = await uc.execute({ campaignId: 'camp_1', orgId: 'org_mg', scheduledAt: future })
    expect(result.status).toBe('scheduled')
  })

  it('rechaza si el remitente no está habilitado', async () => {
    const d = makeDeps({ settings: null })
    const uc = new QueueCampaignSendUseCase(d.campaignRepo, d.sendRepo, d.audienceRepo, d.settingsRepo, idGen)
    await expect(uc.execute({ campaignId: 'camp_1', orgId: 'org_mg' })).rejects.toThrow(/remitente/)
  })

  it('rechaza campaña sin asunto', async () => {
    const d = makeDeps({ campaign: makeCampaign({ subject: null }) })
    const uc = new QueueCampaignSendUseCase(d.campaignRepo, d.sendRepo, d.audienceRepo, d.settingsRepo, idGen)
    await expect(uc.execute({ campaignId: 'camp_1', orgId: 'org_mg' })).rejects.toThrow(/asunto/)
  })

  it('rechaza audiencia vacía', async () => {
    const d = makeDeps({ recipients: [] })
    const uc = new QueueCampaignSendUseCase(d.campaignRepo, d.sendRepo, d.audienceRepo, d.settingsRepo, idGen)
    await expect(uc.execute({ campaignId: 'camp_1', orgId: 'org_mg' })).rejects.toThrow(/vacía/)
  })

  it('rechaza re-encolar una campaña ya enviada', async () => {
    const d = makeDeps({ campaign: makeCampaign({ status: 'sent' }) })
    const uc = new QueueCampaignSendUseCase(d.campaignRepo, d.sendRepo, d.audienceRepo, d.settingsRepo, idGen)
    await expect(uc.execute({ campaignId: 'camp_1', orgId: 'org_mg' })).rejects.toThrow(/estado/)
  })
})
