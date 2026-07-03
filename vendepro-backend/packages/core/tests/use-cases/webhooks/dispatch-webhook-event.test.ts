import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DispatchWebhookEventUseCase } from '../../../src/application/use-cases/webhooks/dispatch-webhook-event'
import { TestWebhookUseCase } from '../../../src/application/use-cases/webhooks/test-webhook'
import { Webhook } from '../../../src/domain/entities/webhook'
import { NotFoundError } from '../../../src/domain/errors/not-found'

const mockRepo = {
  save: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  findActiveByEvent: vi.fn(),
  delete: vi.fn(),
  touchLastTriggered: vi.fn().mockResolvedValue(undefined),
}

const mockDeliveries = {
  log: vi.fn().mockResolvedValue(undefined),
  findByWebhook: vi.fn(),
}

const mockSender = { send: vi.fn() }

let idSeq = 0
const mockIds = { generate: vi.fn(() => `del-${++idSeq}`) }

function makeWebhook(id: string, events: string[] = ['lead.created']) {
  return Webhook.create({
    id, org_id: 'org_mg', name: null, url: `https://hooks.example.com/${id}`,
    secret: `whsec_${id}`, events, is_active: true, last_triggered_at: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  idSeq = 0
  mockRepo.touchLastTriggered.mockResolvedValue(undefined)
  mockDeliveries.log.mockResolvedValue(undefined)
})

describe('DispatchWebhookEventUseCase', () => {
  it('no hace nada si no hay webhooks suscriptos', async () => {
    mockRepo.findActiveByEvent.mockResolvedValue([])
    const uc = new DispatchWebhookEventUseCase(mockRepo, mockDeliveries, mockSender, mockIds)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead.created', payload: { lead_id: 'l1' } })
    expect(result).toEqual({ dispatched: 0, delivered: 0 })
    expect(mockSender.send).not.toHaveBeenCalled()
  })

  it('entrega a todos los suscriptos con el body firmable y loguea success', async () => {
    mockRepo.findActiveByEvent.mockResolvedValue([makeWebhook('wh-1'), makeWebhook('wh-2')])
    mockSender.send.mockResolvedValue({ ok: true, status: 200, error: null })

    const uc = new DispatchWebhookEventUseCase(mockRepo, mockDeliveries, mockSender, mockIds)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead.created', payload: { lead_id: 'l1' } })

    expect(result).toEqual({ dispatched: 2, delivered: 2 })
    expect(mockSender.send).toHaveBeenCalledTimes(2)
    const [url, secret, body] = mockSender.send.mock.calls[0]
    expect(url).toBe('https://hooks.example.com/wh-1')
    expect(secret).toBe('whsec_wh-1')
    const parsed = JSON.parse(body)
    expect(parsed.event).toBe('lead.created')
    expect(parsed.data).toEqual({ lead_id: 'l1' })
    expect(mockDeliveries.log).toHaveBeenCalledTimes(2)
    expect(mockDeliveries.log.mock.calls[0][0]).toMatchObject({ status: 'success', http_status: 200, attempts: 1 })
    expect(mockRepo.touchLastTriggered).toHaveBeenCalledTimes(2)
  })

  it('reintenta una vez ante 5xx y loguea attempts=2', async () => {
    mockRepo.findActiveByEvent.mockResolvedValue([makeWebhook('wh-1')])
    mockSender.send
      .mockResolvedValueOnce({ ok: false, status: 503, error: 'HTTP 503' })
      .mockResolvedValueOnce({ ok: true, status: 200, error: null })

    const uc = new DispatchWebhookEventUseCase(mockRepo, mockDeliveries, mockSender, mockIds)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead.created', payload: {} })

    expect(result).toEqual({ dispatched: 1, delivered: 1 })
    expect(mockSender.send).toHaveBeenCalledTimes(2)
    expect(mockDeliveries.log.mock.calls[0][0]).toMatchObject({ status: 'success', attempts: 2 })
  })

  it('reintenta ante timeout (status null) y loguea failed si vuelve a fallar', async () => {
    mockRepo.findActiveByEvent.mockResolvedValue([makeWebhook('wh-1')])
    mockSender.send.mockResolvedValue({ ok: false, status: null, error: 'timeout' })

    const uc = new DispatchWebhookEventUseCase(mockRepo, mockDeliveries, mockSender, mockIds)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead.created', payload: {} })

    expect(result).toEqual({ dispatched: 1, delivered: 0 })
    expect(mockSender.send).toHaveBeenCalledTimes(2)
    expect(mockDeliveries.log.mock.calls[0][0]).toMatchObject({
      status: 'failed', http_status: null, attempts: 2, error: 'timeout',
    })
    expect(mockRepo.touchLastTriggered).not.toHaveBeenCalled()
  })

  it('NO reintenta ante 4xx (config del receptor)', async () => {
    mockRepo.findActiveByEvent.mockResolvedValue([makeWebhook('wh-1')])
    mockSender.send.mockResolvedValue({ ok: false, status: 404, error: 'HTTP 404' })

    const uc = new DispatchWebhookEventUseCase(mockRepo, mockDeliveries, mockSender, mockIds)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead.created', payload: {} })

    expect(result).toEqual({ dispatched: 1, delivered: 0 })
    expect(mockSender.send).toHaveBeenCalledTimes(1)
    expect(mockDeliveries.log.mock.calls[0][0]).toMatchObject({ status: 'failed', attempts: 1 })
  })

  it('un webhook caído no impide la entrega a los demás', async () => {
    mockRepo.findActiveByEvent.mockResolvedValue([makeWebhook('wh-1'), makeWebhook('wh-2')])
    mockSender.send.mockImplementation(async (url: string) =>
      url.includes('wh-1')
        ? { ok: false, status: 400, error: 'HTTP 400' }
        : { ok: true, status: 200, error: null },
    )

    const uc = new DispatchWebhookEventUseCase(mockRepo, mockDeliveries, mockSender, mockIds)
    const result = await uc.execute({ orgId: 'org_mg', event: 'lead.created', payload: {} })
    expect(result).toEqual({ dispatched: 2, delivered: 1 })
  })
})

describe('TestWebhookUseCase', () => {
  it('envía webhook.test al hook puntual y devuelve el resultado', async () => {
    mockRepo.findById.mockResolvedValue(makeWebhook('wh-1'))
    mockSender.send.mockResolvedValue({ ok: true, status: 200, error: null })

    const uc = new TestWebhookUseCase(mockRepo, mockDeliveries, mockSender, mockIds)
    const result = await uc.execute({ id: 'wh-1', orgId: 'org_mg' })

    expect(result).toEqual({ ok: true, status: 200, error: null })
    const body = JSON.parse(mockSender.send.mock.calls[0][2])
    expect(body.event).toBe('webhook.test')
    expect(mockDeliveries.log).toHaveBeenCalledTimes(1)
  })

  it('falla si el webhook no existe', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const uc = new TestWebhookUseCase(mockRepo, mockDeliveries, mockSender, mockIds)
    await expect(uc.execute({ id: 'wh-x', orgId: 'org_mg' })).rejects.toThrow(NotFoundError)
  })
})
